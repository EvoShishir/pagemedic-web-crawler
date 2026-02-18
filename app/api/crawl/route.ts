import { chromium, Page, Request, Response as PlaywrightResponse } from "playwright";
import { NextRequest } from "next/server";
import https from "https";
import http from "http";
import { BrokenLink, BrokenImage, ConsoleError } from "../../types/crawler";

// Domains that commonly block automated requests (false positives)
const SKIP_EXTERNAL_DOMAINS = [
  "twitter.com",
  "x.com",
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "youtube.com",
  "pinterest.com",
  "reddit.com",
  "discord.com",
  "whatsapp.com",
  "t.me",
  "telegram.org",
  "snapchat.com",
  "medium.com",
  "apple.com",
  "apps.apple.com",
  "play.google.com",
];

// File extensions that should not be crawled as pages (but checked for existence)
const NON_HTML_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".zip",
  ".rar",
  ".7z",
  ".tar",
  ".gz",
  ".mp3",
  ".mp4",
  ".avi",
  ".mov",
  ".wmv",
  ".wav",
  ".ogg",
  ".webm",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".bmp",
  ".tiff",
  ".tif",
  ".eps",
  ".ai",
  ".psd",
  ".css",
  ".js",
  ".json",
  ".xml",
  ".txt",
  ".csv",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
];

// Error messages to ignore (not actual broken resources)
const IGNORE_ERROR_PATTERNS = [
  /CORS/i,
  /Access-Control-Allow-Origin/i,
  /cross-origin/i,
  /net::ERR_ABORTED/i,
  /net::ERR_BLOCKED/i,
  /net::ERR_FAILED/i, // Often transient
  /SecurityError/i,
  /Mixed Content/i,
  /insecure content/i,
];

function shouldIgnoreError(message: string): boolean {
  return IGNORE_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function isNonHtmlResource(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return NON_HTML_EXTENSIONS.some((ext) => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

// Clean URL by removing hash fragments (they're just anchors, not different pages)
function cleanUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = ""; // Remove hash fragment
    return parsed.toString();
  } catch {
    return url;
  }
}

// Check if URL is just a hash link (e.g., "#section" or "page#section")
function isHashOnlyOrAnchor(url: string): boolean {
  try {
    const parsed = new URL(url);
    // If pathname is just "/" or empty and there's a hash, it's an anchor
    return parsed.hash !== "" && (parsed.pathname === "/" || parsed.pathname === "");
  } catch {
    // If it starts with #, it's an anchor
    return url.startsWith("#");
  }
}

function shouldSkipExternalCheck(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return SKIP_EXTERNAL_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

// Link reference info - tracks where a link was found
interface LinkReference {
  foundOnPage: string;
  linkText: string;
  elementContext: string;
}

// Helper to create SSE response
function createSSEResponse() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController;
  let isClosed = false;

  const stream = new ReadableStream({
    start(c) {
      controller = c;
    },
  });

  const sendEvent = (data: any) => {
    if (isClosed) return;
    try {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      controller.enqueue(encoder.encode(message));
    } catch (err) {
      // Controller might be closed
      isClosed = true;
    }
  };

  const close = () => {
    if (!isClosed) {
      try {
        controller.close();
        isClosed = true;
      } catch (err) {
        // Already closed
        isClosed = true;
      }
    }
  };

  return { stream, sendEvent, close };
}

// Fetch and parse sitemap
async function fetchSitemap(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const options = {
      rejectUnauthorized: false, // Allow self-signed certificates
    };
    protocol
      .get(url, options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

function parseSitemap(xml: string): string[] {
  const urls = new Set<string>();
  const locMatches = xml.match(/<loc>(.*?)<\/loc>/g) || [];

  for (const match of locMatches) {
    const loc = match.replace(/<\/?loc>/g, "").trim();
    urls.add(loc);
  }

  return [...urls];
}

// Check URL status with HEAD request
async function checkUrlStatus(
  url: string
): Promise<{ status: number; ok: boolean }> {
  return new Promise((resolve) => {
    const protocol = url.startsWith("https") ? https : http;
    try {
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (url.startsWith("https") ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: "HEAD",
        timeout: 10000,
        rejectUnauthorized: false,
      };
      const req = protocol.request(options, (res) => {
        resolve({ status: res.statusCode || 0, ok: (res.statusCode || 0) < 400 });
      });
      req.on("error", () => resolve({ status: 0, ok: false }));
      req.on("timeout", () => {
        req.destroy();
        resolve({ status: 0, ok: false });
      });
      req.end();
    } catch {
      resolve({ status: 0, ok: false });
    }
  });
}

// Build a scoped selector that handles comma-separated selectors properly
// e.g., ".main, #content" becomes ".main a[href], #content a[href]"
function buildScopedSelector(baseSelector: string, targetSelector: string): string {
  return baseSelector
    .split(",")
    .map((s) => `${s.trim()} ${targetSelector}`)
    .join(", ");
}

// Extract link info from page (optionally scoped to a CSS selector)
async function extractLinksWithContext(page: Page, cssSelector?: string): Promise<
  Array<{
    href: string;
    text: string;
    context: string;
    isInHeader: boolean;
  }>
> {
  const selector = cssSelector ? buildScopedSelector(cssSelector, "a[href]") : "a[href]";
  return page.$$eval(selector, (anchors) => {
    return anchors.map((a) => {
      const anchor = a as HTMLAnchorElement;
      const parent = anchor.closest("nav, header, footer, article, section, aside, main");
      const parentTag = parent?.tagName.toLowerCase() || "body";
      const parentClass = parent?.className
        ? `.${parent.className.split(" ").filter(Boolean).slice(0, 2).join(".")}`
        : "";

      // Check if this link is inside a header or nav element
      const isInHeader = anchor.closest("header, nav") !== null;

      return {
        href: anchor.href,
        text: anchor.textContent?.trim() || "[No text]",
        context: `<${parentTag}${parentClass}>`,
        isInHeader,
      };
    });
  });
}

// Extract image info from page (optionally scoped to a CSS selector)
async function extractImagesWithContext(page: Page, cssSelector?: string): Promise<
  Array<{
    src: string;
    alt: string;
    context: string;
    naturalWidth: number;
    complete: boolean;
  }>
> {
  const selector = cssSelector ? buildScopedSelector(cssSelector, "img") : "img";
  return page.$$eval(selector, (images) => {
    return images.map((img) => {
      const image = img as HTMLImageElement;
      const parent = image.closest("figure, article, section, header, footer, aside, main, div");
      const parentTag = parent?.tagName.toLowerCase() || "body";
      const parentClass = parent?.className
        ? `.${parent.className.split(" ").filter(Boolean).slice(0, 2).join(".")}`
        : "";

      return {
        src: image.src,
        alt: image.alt || "[No alt text]",
        context: `<${parentTag}${parentClass}>`,
        naturalWidth: image.naturalWidth,
        complete: image.complete,
      };
    });
  });
}

// Extract URLs from meta tags, link elements, and JSON-LD in page source
async function extractMetaUrls(page: Page): Promise<
  Array<{ url: string; context: string }>
> {
  return page.evaluate(() => {
    const results: Array<{ url: string; context: string }> = [];
    const seen = new Set<string>();

    function addUrl(url: string, context: string) {
      if (!url || seen.has(url)) return;
      try {
        const parsed = new URL(url, window.location.href);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          seen.add(parsed.href);
          results.push({ url: parsed.href, context });
        }
      } catch { /* invalid URL */ }
    }

    // <link> elements (canonical, alternate, stylesheet, icon, etc.)
    document.querySelectorAll("link[href]").forEach((el) => {
      const link = el as HTMLLinkElement;
      const rel = link.getAttribute("rel") || "unknown";
      addUrl(link.href, `<link rel="${rel}">`);
    });

    // <meta property="og:*"> and <meta name="twitter:*">
    document.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]').forEach((el) => {
      const meta = el as HTMLMetaElement;
      const name = meta.getAttribute("property") || meta.getAttribute("name") || "";
      const content = meta.getAttribute("content") || "";
      if (content.startsWith("http")) {
        addUrl(content, `<meta ${name}>`);
      }
    });

    // <meta http-equiv="refresh">
    document.querySelectorAll('meta[http-equiv="refresh"]').forEach((el) => {
      const content = el.getAttribute("content") || "";
      const urlMatch = content.match(/url\s*=\s*['"]?(https?:\/\/[^'";\s]+)/i);
      if (urlMatch) {
        addUrl(urlMatch[1], `<meta http-equiv="refresh">`);
      }
    });

    // JSON-LD structured data
    document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
      try {
        const json = JSON.parse(el.textContent || "");
        const extractUrls = (obj: unknown, depth: number) => {
          if (depth > 5) return;
          if (typeof obj === "string" && obj.startsWith("http")) {
            addUrl(obj, "<script ld+json>");
          } else if (Array.isArray(obj)) {
            obj.forEach((item) => extractUrls(item, depth + 1));
          } else if (obj && typeof obj === "object") {
            Object.values(obj).forEach((val) => extractUrls(val, depth + 1));
          }
        };
        extractUrls(json, 0);
      } catch { /* invalid JSON */ }
    });

    return results;
  });
}

// Parse 404 error from console message
function parse404FromConsoleError(message: string): { url: string; status: number } | null {
  // Skip CORS and other ignorable errors
  if (shouldIgnoreError(message)) {
    return null;
  }

  // Match patterns like "Failed to load resource: the server responded with a status of 404 ()"
  const statusMatch = message.match(/status of (\d{3})/);
  if (statusMatch) {
    const status = parseInt(statusMatch[1], 10);
    if (status >= 400 && status < 500) { // Only 4xx errors, not 5xx
      // Try to extract URL from the message
      const urlMatch = message.match(/(https?:\/\/[^\s]+)/);
      if (urlMatch) {
        return { url: urlMatch[1], status };
      }
    }
  }
  return null;
}

// Determine resource type from URL or content-type
function getResourceType(url: string, contentType?: string): "link" | "image" | "document" | "other" {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    
    // URLs with hash fragments that don't have file extensions are links
    if (parsed.hash && !pathname.match(/\.[a-z0-9]{2,5}$/i)) {
      return "link";
    }
    
    // Check by file extension - images
    if (/\.(jpg|jpeg|png|gif|webp|svg|ico|bmp|tiff?)$/i.test(pathname)) {
      return "image";
    }
    
    // Check by file extension - documents (PDFs, etc.)
    if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i.test(pathname)) {
      return "document";
    }
    
    // Check by content-type
    if (contentType) {
      if (contentType.startsWith("image/")) {
        return "image";
      }
      if (contentType.includes("pdf") || contentType.includes("document")) {
        return "document";
      }
    }
    
    // Check if it looks like a page (no extension or HTML-like extension)
    if (/\.(html?|php|aspx?|jsp)$/i.test(pathname) || !pathname.match(/\.[a-z0-9]{2,5}$/i)) {
      return "link";
    }
    
    return "other";
  } catch {
    return "link"; // Default to link if URL parsing fails
  }
}

// Handle both GET (legacy/EventSource) and POST (for large payloads)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const startUrl = searchParams.get("startUrl");
  const sitemapUrl = searchParams.get("sitemapUrl");
  const selectedUrlsParam = searchParams.get("selectedUrls");

  if (!startUrl) {
    return new Response("Missing startUrl parameter", { status: 400 });
  }

  // Parse selected URLs if provided (JSON array) - clean URLs to ensure consistent matching
  let selectedUrls: Set<string> | null = null;
  if (selectedUrlsParam) {
    try {
      const parsed = JSON.parse(decodeURIComponent(selectedUrlsParam));
      if (Array.isArray(parsed)) {
        selectedUrls = new Set(parsed.map((url: string) => cleanUrl(url)));
      }
    } catch {
      // Invalid JSON, ignore
    }
  }

  return handleCrawl(startUrl, sitemapUrl, selectedUrls);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startUrl, sitemapUrl, cssSelector, concurrency: concurrencyParam, selectedUrls: selectedUrlsArray, allDiscoveredUrls: allDiscoveredArray } = body;

    if (!startUrl) {
      return new Response("Missing startUrl parameter", { status: 400 });
    }

    // Parse selected URLs from body - clean URLs to ensure consistent matching
    let selectedUrls: Set<string> | null = null;
    if (Array.isArray(selectedUrlsArray)) {
      selectedUrls = new Set(selectedUrlsArray.map((url: string) => cleanUrl(url)));
    }

    // Parse all discovered URLs (from sitemap) - these should be skipped from validation
    let allDiscoveredUrls: Set<string> | null = null;
    if (Array.isArray(allDiscoveredArray)) {
      allDiscoveredUrls = new Set(allDiscoveredArray.map((url: string) => cleanUrl(url)));
    }

    const concurrency = Math.min(Math.max(parseInt(concurrencyParam) || 3, 1), 20);
    return handleCrawl(startUrl, sitemapUrl || null, selectedUrls, allDiscoveredUrls, cssSelector || undefined, concurrency);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    return new Response(`Invalid request body: ${errMsg}`, { status: 400 });
  }
}

function handleCrawl(
  startUrl: string,
  sitemapUrl: string | null,
  selectedUrls: Set<string> | null,
  allDiscoveredUrls: Set<string> | null = null,
  cssSelector?: string,
  concurrency: number = 3
) {

  const { stream, sendEvent, close } = createSSEResponse();

  // Start crawling in the background
  (async () => {
    let browser;

    try {
      sendEvent({ type: "log", message: `🚀 Starting crawler... (${concurrency} parallel worker${concurrency > 1 ? "s" : ""})` });
      if (cssSelector) {
        sendEvent({ type: "log", message: `🎯 CSS selector active: ${cssSelector}` });
      }

      browser = await chromium.launch({ headless: true, args: ["--disable-http2"] });
      const context = await browser.newContext({
        ignoreHTTPSErrors: true,
      });

      // Create worker pages
      const pages: Page[] = [];
      for (let i = 0; i < concurrency; i++) {
        pages.push(await context.newPage());
      }

      const visited = new Set<string>();
      const checkedResources = new Set<string>();
      
      const queue: string[] = selectedUrls ? [...selectedUrls] : [startUrl];
      const origin = new URL(startUrl).origin;
      
      const isSelectiveMode = selectedUrls !== null;
      const linkRegistry = new Map<string, LinkReference[]>();

      let totalCrawled = 0;
      let brokenLinksCount = 0;
      let brokenImagesCount = 0;
      

      // Track which URL each page is currently processing
      const pageCurrentUrl = new Map<Page, string>();
      
      let isFirstPage = true;
      const hasSitemap = !!sitemapUrl;

      const registerLink = (url: string, ref: LinkReference) => {
        if (!linkRegistry.has(url)) {
          linkRegistry.set(url, []);
        }
        const refs = linkRegistry.get(url)!;
        if (!refs.some(r => r.foundOnPage === ref.foundOnPage && r.linkText === ref.linkText)) {
          refs.push(ref);
        }
      };

      const getLinkReferences = (url: string): LinkReference[] => {
        return linkRegistry.get(url) || [];
      };

      // Load sitemap if provided (only if not in selective mode)
      if (sitemapUrl && !isSelectiveMode) {
        sendEvent({ type: "log", message: `📄 Loading sitemap: ${sitemapUrl}` });
        try {
          const xml = await fetchSitemap(sitemapUrl);
          const sitemapUrls = parseSitemap(xml).filter((u) =>
            u.startsWith(origin)
          );

          sitemapUrls.forEach((u) => {
            if (!isNonHtmlResource(u)) {
              queue.push(u);
            }
            registerLink(u, {
              foundOnPage: sitemapUrl,
              linkText: "[From sitemap]",
              elementContext: "<sitemap>",
            });
          });

          sendEvent({
            type: "log",
            message: `✅ Added ${sitemapUrls.length} URLs from sitemap`,
          });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : "Unknown error";
          sendEvent({
            type: "log",
            message: `⚠️ Failed to load sitemap: ${errMsg}`,
          });
        }
      }

      registerLink(startUrl, {
        foundOnPage: "[Start URL]",
        linkText: "[User provided]",
        elementContext: "<input>",
      });

      // Set up event listeners for each worker page
      function setupPageListeners(workerPage: Page) {
        workerPage.on("response", (response: PlaywrightResponse) => {
          const url = response.url();
          const status = response.status();
          const request = response.request();
          const resourceType = request.resourceType();
          const currentUrl = pageCurrentUrl.get(workerPage) || startUrl;

          if (!url.startsWith(origin)) return;
          if (status < 400) return;
          if (checkedResources.has(url)) return;
          if (resourceType === "document") return;
          if (["stylesheet", "font", "script", "media"].includes(resourceType)) return;
          if (url.toLowerCase().includes(".svg")) return;
          
          checkedResources.add(url);

          const contentType = response.headers()["content-type"] || "";
          const type = getResourceType(url, contentType);
          if (type === "document") return;

          if ((type === "image" || resourceType === "image") && status >= 400) {
            brokenImagesCount++;
            const brokenImage: BrokenImage = {
              src: url,
              foundOnPage: currentUrl,
              altText: "[Detected from network]",
              elementContext: `<${resourceType}>`,
              reason: `HTTP ${status} - Resource not found`,
              timestamp: new Date().toISOString(),
            };
            sendEvent({
              type: "broken_image",
              message: `🖼️❌ Broken image (${status}): ${url}`,
              data: brokenImage,
            });
          } else if (type === "link" || resourceType === "fetch" || resourceType === "xhr") {
            const references = getLinkReferences(url);
            if (references.length > 0) {
              for (const ref of references) {
                brokenLinksCount++;
                sendEvent({
                  type: "broken_link",
                  message: `🔗❌ Broken resource (${status}): ${url} | Linked from: ${ref.foundOnPage}`,
                  data: { url, statusCode: status, foundOnPage: ref.foundOnPage, linkText: ref.linkText, elementContext: ref.elementContext, timestamp: new Date().toISOString() } as BrokenLink,
                });
              }
            } else {
              brokenLinksCount++;
              sendEvent({
                type: "broken_link",
                message: `🔗❌ Broken resource (${status}): ${url}`,
                data: { url, statusCode: status, foundOnPage: currentUrl, linkText: "[Detected from network]", elementContext: `<${resourceType}>`, timestamp: new Date().toISOString() } as BrokenLink,
              });
            }
          }
        });

        workerPage.on("requestfailed", (request: Request) => {
          const url = request.url();
          const currentUrl = pageCurrentUrl.get(workerPage) || startUrl;
          if (!url.startsWith(origin)) return;
          if (checkedResources.has(url)) return;

          const failure = request.failure();
          const errorText = failure?.errorText || "";
          const resourceType = request.resourceType();

          if (shouldIgnoreError(errorText) || 
              errorText.includes("ERR_ABORTED") || errorText.includes("ERR_BLOCKED") ||
              errorText.includes("ERR_FAILED") || errorText.includes("ERR_CACHE") ||
              errorText.includes("ERR_CONNECTION")) return;
          if (resourceType === "document") return;
          if (["stylesheet", "font", "script", "media"].includes(resourceType)) return;
          if (url.toLowerCase().includes(".svg")) return;

          checkedResources.add(url);

          sendEvent({ type: "log", message: `🚫 Request failed: ${url} | Reason: ${errorText} | Page: ${currentUrl}` });

          if (resourceType === "image" && errorText.includes("ERR_NAME_NOT_RESOLVED")) {
            brokenImagesCount++;
            sendEvent({
              type: "broken_image",
              message: `🖼️❌ Broken image: ${url}`,
              data: { src: url, foundOnPage: currentUrl, altText: "[Detected from network]", elementContext: `<${resourceType}>`, reason: errorText || "Request failed", timestamp: new Date().toISOString() } as BrokenImage,
            });
          }
        });

        workerPage.on("console", (msg) => {
          if (msg.type() === "error") {
            const text = msg.text();
            const currentUrl = pageCurrentUrl.get(workerPage) || startUrl;
            if (shouldIgnoreError(text)) return;
            
            sendEvent({ type: "log", message: `❌ Console error: ${text} | Page: ${currentUrl}` });
            sendEvent({
              type: "console_error",
              message: `❌ Console error: ${text}`,
              data: { message: text, foundOnPage: currentUrl, type: "error", timestamp: new Date().toISOString() } as ConsoleError,
            });

            const parsed = parse404FromConsoleError(text);
            if (parsed && parsed.url.startsWith(origin) && !checkedResources.has(parsed.url)) {
              if (isNonHtmlResource(parsed.url) || parsed.url.toLowerCase().includes(".svg")) return;
              checkedResources.add(parsed.url);
              
              const type = getResourceType(parsed.url);
              if (type === "image" && parsed.status === 404) {
                brokenImagesCount++;
                sendEvent({
                  type: "broken_image",
                  message: `🖼️❌ Broken image (${parsed.status}): ${parsed.url.slice(0, 80)}...`,
                  data: { src: parsed.url, foundOnPage: currentUrl, altText: "[Detected from console]", elementContext: "<console-error>", reason: `HTTP ${parsed.status} - From console error`, timestamp: new Date().toISOString() } as BrokenImage,
                });
              } else if (type === "link") {
                const references = getLinkReferences(parsed.url);
                if (references.length > 0) {
                  for (const ref of references) {
                    brokenLinksCount++;
                    sendEvent({
                      type: "broken_link",
                      message: `🔗❌ Broken resource (${parsed.status}): ${parsed.url} | Linked from: ${ref.foundOnPage}`,
                      data: { url: parsed.url, statusCode: parsed.status, foundOnPage: ref.foundOnPage, linkText: ref.linkText, elementContext: ref.elementContext, timestamp: new Date().toISOString() } as BrokenLink,
                    });
                  }
                } else {
                  brokenLinksCount++;
                  sendEvent({
                    type: "broken_link",
                    message: `🔗❌ Broken resource (${parsed.status}): ${parsed.url}`,
                    data: { url: parsed.url, statusCode: parsed.status, foundOnPage: currentUrl, linkText: "[Detected from console]", elementContext: "<console-error>", timestamp: new Date().toISOString() } as BrokenLink,
                  });
                }
              }
            }
          }
        });

        workerPage.on("pageerror", (err) => {
          const currentUrl = pageCurrentUrl.get(workerPage) || startUrl;
          sendEvent({ type: "log", message: `🔥 JS error: ${err.message} | Page: ${currentUrl}` });
          sendEvent({
            type: "console_error",
            message: `🔥 JS error: ${err.message}`,
            data: { message: err.message, foundOnPage: currentUrl, type: "js_error", timestamp: new Date().toISOString() } as ConsoleError,
          });
        });
      }

      // Set up listeners on all worker pages
      for (const workerPage of pages) {
        setupPageListeners(workerPage);
      }

      // Worker function: process a single URL
      async function processUrl(workerPage: Page, url: string, workerId: number) {
        // Skip non-HTML resources
        if (isNonHtmlResource(url)) {
          const references = getLinkReferences(url);
          if (references.length > 0 && !checkedResources.has(url)) {
            const { status, ok } = await checkUrlStatus(url);
            checkedResources.add(url);
            if (!ok && status >= 400) {
              for (const ref of references) {
                brokenLinksCount++;
                sendEvent({
                  type: "broken_link",
                  message: `🔗❌ Broken resource (${status}): ${url} | Linked from: ${ref.foundOnPage}`,
                  data: { url, statusCode: status, foundOnPage: ref.foundOnPage, linkText: ref.linkText, elementContext: ref.elementContext, timestamp: new Date().toISOString() } as BrokenLink,
                });
              }
            }
          }
          return;
        }

        totalCrawled++;
        pageCurrentUrl.set(workerPage, url);
        const wTag = concurrency > 1 ? `[W${workerId}] ` : "";

        sendEvent({
          type: "log",
          message: `\n${wTag}🔍 Crawling (${totalCrawled}): ${url}`,
        });

        try {
          const MAX_RETRIES = 3;
          let response: Awaited<ReturnType<Page["goto"]>> = null;
          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
              response = await workerPage.goto(url, {
                waitUntil: "domcontentloaded",
                timeout: 30000,
              });
              break;
            } catch (navErr: unknown) {
              const msg = navErr instanceof Error ? navErr.message : "";
              const isRetryable = /ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED|ERR_TIMED_OUT|ERR_HTTP2|ERR_NETWORK_CHANGED|ERR_SOCKET_NOT_CONNECTED/.test(msg);
              if (isRetryable && attempt < MAX_RETRIES) {
                sendEvent({ type: "log", message: `${wTag}⚠️ Retry ${attempt}/${MAX_RETRIES} for ${url}` });
                await new Promise((r) => setTimeout(r, 2000 * attempt));
                continue;
              }
              throw navErr;
            }
          }
          
          await workerPage.waitForTimeout(2000);

          // Check if the page itself is a 404
          if (response && response.status() >= 400) {
            const status = response.status();
            sendEvent({ type: "log", message: `${wTag}⚠️ Page returned ${status}: ${url}` });

            const references = getLinkReferences(url);
            if (!checkedResources.has(url)) {
              checkedResources.add(url);
              if (references.length > 0) {
                for (const ref of references) {
                  brokenLinksCount++;
                  sendEvent({
                    type: "broken_link",
                    message: `🔗❌ Broken page (${status}): ${url} | Linked from: ${ref.foundOnPage}`,
                    data: { url, statusCode: status, foundOnPage: ref.foundOnPage, linkText: ref.linkText, elementContext: ref.elementContext, timestamp: new Date().toISOString() } as BrokenLink,
                  });
                }
              } else {
                brokenLinksCount++;
                sendEvent({
                  type: "broken_link",
                  message: `🔗❌ Broken page (${status}): ${url}`,
                  data: { url, statusCode: status, foundOnPage: "[Unknown source]", linkText: "[Unknown]", elementContext: "<unknown>", timestamp: new Date().toISOString() } as BrokenLink,
                });
              }
            }
            return;
          }

          // Extract links
          const links = await extractLinksWithContext(workerPage, cssSelector);
          const internalLinks = links
            .filter((l) => l.href.startsWith(origin))
            .filter((l) => !isHashOnlyOrAnchor(l.href));

          const headerLinks = internalLinks.filter((l) => l.isInHeader);
          const contentLinks = internalLinks.filter((l) => !l.isInHeader);
          const allExternalLinks = links.filter((l) => {
            try {
              const linkUrl = new URL(l.href);
              return (linkUrl.protocol === "http:" || linkUrl.protocol === "https:") && !l.href.startsWith(origin);
            } catch { return false; }
          });

          sendEvent({
            type: "log",
            message: `${wTag}🔗 Found ${links.length} links (${internalLinks.length} internal: ${contentLinks.length} content, ${headerLinks.length} header/nav | ${allExternalLinks.length} external)`,
          });

          // Register and queue internal links
          const linksToValidate: Array<{ url: string; text: string; context: string }> = [];
          let skippedHeaderLinks = 0;
          let skippedAlreadyVisited = 0;
          let skippedInSitemap = 0;
          let addedToQueue = 0;

          for (const link of internalLinks) {
            const cleanedUrl = cleanUrl(link.href);
            
            if (link.isInHeader) {
              if (hasSitemap) { skippedHeaderLinks++; continue; }
              else if (!isFirstPage) { skippedHeaderLinks++; continue; }
            }
            
            registerLink(cleanedUrl, { foundOnPage: url, linkText: link.text, elementContext: link.context });
            
            if (!isSelectiveMode && !visited.has(cleanedUrl) && !queue.includes(cleanedUrl)) {
              queue.push(cleanedUrl);
              addedToQueue++;
            } else if (isSelectiveMode) {
              if (visited.has(cleanedUrl) || checkedResources.has(cleanedUrl)) {
                skippedAlreadyVisited++;
              } else if (selectedUrls?.has(cleanedUrl)) {
                // Will be crawled
              } else if (allDiscoveredUrls?.has(cleanedUrl)) {
                skippedInSitemap++;
              } else if (!queue.includes(cleanedUrl)) {
                linksToValidate.push({ url: cleanedUrl, text: link.text, context: link.context });
              }
            }
          }

          if (isSelectiveMode) {
            const parts = [];
            if (linksToValidate.length > 0) parts.push(`${linksToValidate.length} to validate`);
            if (skippedInSitemap > 0) parts.push(`${skippedInSitemap} in sitemap (assumed valid)`);
            if (skippedAlreadyVisited > 0) parts.push(`${skippedAlreadyVisited} already checked`);
            if (skippedHeaderLinks > 0) parts.push(`${skippedHeaderLinks} header/nav skipped`);
            if (parts.length > 0) {
              sendEvent({ type: "log", message: `${wTag}   ↳ Internal links: ${parts.join(", ")}` });
            }
          } else if (addedToQueue > 0) {
            sendEvent({ type: "log", message: `${wTag}   ↳ Added ${addedToQueue} new internal links to crawl queue` });
          }
          
          if (isFirstPage) isFirstPage = false;

          // Validate links that won't be crawled
          if (linksToValidate.length > 0) {
            const totalToValidate = linksToValidate.length;
            sendEvent({ type: "log", message: `${wTag}🔎 Validating ${totalToValidate} links not in crawl queue...` });

            let validatedCount = 0;
            let brokenCount = 0;
            let skippedCount = 0;

            for (let i = 0; i < linksToValidate.length; i++) {
              const link = linksToValidate[i];
              if (checkedResources.has(link.url)) { skippedCount++; continue; }
              checkedResources.add(link.url);
              
              sendEvent({ type: "log", message: `${wTag}   ↳ [${i + 1}/${totalToValidate}] Checking: ${link.url}` });

              const { status, ok } = await checkUrlStatus(link.url);
              validatedCount++;

              if (!ok && status >= 400) {
                brokenCount++;
                brokenLinksCount++;
                sendEvent({
                  type: "broken_link",
                  message: `${wTag}   ↳ ❌ [${status}] ${link.url}`,
                  data: { url: link.url, statusCode: status, foundOnPage: url, linkText: link.text, elementContext: link.context, timestamp: new Date().toISOString() } as BrokenLink,
                });
              } else if (status === 0) {
                brokenCount++;
                brokenLinksCount++;
                sendEvent({
                  type: "broken_link",
                  message: `${wTag}   ↳ ❌ [Unreachable] ${link.url}`,
                  data: { url: link.url, statusCode: 0, foundOnPage: url, linkText: link.text, elementContext: link.context, timestamp: new Date().toISOString() } as BrokenLink,
                });
              } else {
                sendEvent({ type: "log", message: `${wTag}   ↳ ✓ [${status}] OK` });
              }
            }

            sendEvent({
              type: "log",
              message: `${wTag}✅ Link validation complete: ${validatedCount} checked, ${brokenCount} broken${skippedCount > 0 ? `, ${skippedCount} skipped (already checked)` : ""}`,
            });
          }

          // Check external links
          const externalLinks = links
            .filter((l) => {
              try {
                const linkUrl = new URL(l.href);
                return (linkUrl.protocol === "http:" || linkUrl.protocol === "https:") && !l.href.startsWith(origin);
              } catch { return false; }
            })
            .filter((l) => !l.isInHeader)
            .filter((l) => !shouldSkipExternalCheck(l.href));

          if (externalLinks.length > 0) {
            sendEvent({ type: "log", message: `${wTag}🌐 Checking ${externalLinks.length} external links...` });
            let externalChecked = 0;
            let externalBroken = 0;

            for (let i = 0; i < externalLinks.length; i++) {
              const link = externalLinks[i];
              if (checkedResources.has(link.href)) continue;
              checkedResources.add(link.href);

              sendEvent({ type: "log", message: `${wTag}   ↳ [${i + 1}/${externalLinks.length}] Checking: ${link.href}` });

              const { status, ok } = await checkUrlStatus(link.href);
              externalChecked++;

              if (!ok && status >= 400) {
                externalBroken++;
                brokenLinksCount++;
                sendEvent({
                  type: "broken_link",
                  message: `${wTag}   ↳ ❌ [${status}] ${link.href}`,
                  data: { url: link.href, statusCode: status, foundOnPage: url, linkText: link.text, elementContext: link.context, timestamp: new Date().toISOString() } as BrokenLink,
                });
              } else if (status === 0) {
                externalBroken++;
                brokenLinksCount++;
                sendEvent({
                  type: "broken_link",
                  message: `${wTag}   ↳ ❌ [Unreachable] ${link.href}`,
                  data: { url: link.href, statusCode: 0, foundOnPage: url, linkText: link.text, elementContext: link.context, timestamp: new Date().toISOString() } as BrokenLink,
                });
              } else {
                sendEvent({ type: "log", message: `${wTag}   ↳ ✓ [${status}] OK` });
              }
            }

            sendEvent({ type: "log", message: `${wTag}✅ External links: ${externalChecked} checked, ${externalBroken} broken` });
          }

          // Check images
          const images = await extractImagesWithContext(workerPage, cssSelector);
          sendEvent({ type: "log", message: `${wTag}🖼️ Found ${images.length} images` });

          for (const img of images) {
            if (!img.src || checkedResources.has(img.src)) continue;
            if (img.src === "#" || img.src.endsWith("#") || img.src.startsWith("data:") || img.src.startsWith("blob:") || img.src === url || !img.src.startsWith("http")) continue;
            
            let isBroken = false;
            let reason = "";
            const isSvg = img.src.toLowerCase().includes(".svg");
            
            if (!img.complete) { isBroken = true; reason = "Image failed to load (incomplete)"; }
            else if (img.naturalWidth === 0 && !isSvg) { isBroken = true; reason = "Image has zero width (failed to load)"; }

            if (isBroken && img.src.startsWith(origin)) {
              try {
                const headResult = await checkUrlStatus(img.src);
                if (headResult.ok || (headResult.status >= 200 && headResult.status < 400)) isBroken = false;
              } catch { /* HEAD request failed */ }
            }

            if (isBroken) {
              checkedResources.add(img.src);
              brokenImagesCount++;
              sendEvent({
                type: "broken_image",
                message: `${wTag}🖼️❌ Broken image: ${img.src}`,
                data: { src: img.src, foundOnPage: url, altText: img.alt, elementContext: img.context, reason, timestamp: new Date().toISOString() } as BrokenImage,
              });
            }
          }

          // Check meta/source URLs (canonical, og:*, twitter:*, JSON-LD, etc.)
          const metaUrls = await extractMetaUrls(workerPage);
          const uncheckedMeta = metaUrls.filter((m) => !checkedResources.has(m.url));
          if (uncheckedMeta.length > 0) {
            sendEvent({ type: "log", message: `${wTag}📄 Found ${uncheckedMeta.length} meta/source URLs to verify` });
            let metaBroken = 0;
            for (const meta of uncheckedMeta) {
              checkedResources.add(meta.url);
              const { status, ok } = await checkUrlStatus(meta.url);
              if (!ok && status >= 400) {
                metaBroken++;
                brokenLinksCount++;
                sendEvent({
                  type: "broken_link",
                  message: `${wTag}   ↳ ❌ [${status}] ${meta.url} (${meta.context})`,
                  data: { url: meta.url, statusCode: status, foundOnPage: url, linkText: meta.context, elementContext: meta.context, timestamp: new Date().toISOString() } as BrokenLink,
                });
              } else if (status === 0) {
                metaBroken++;
                brokenLinksCount++;
                sendEvent({
                  type: "broken_link",
                  message: `${wTag}   ↳ ❌ [Unreachable] ${meta.url} (${meta.context})`,
                  data: { url: meta.url, statusCode: 0, foundOnPage: url, linkText: meta.context, elementContext: meta.context, timestamp: new Date().toISOString() } as BrokenLink,
                });
              }
            }
            if (metaBroken > 0) {
              sendEvent({ type: "log", message: `${wTag}📄 Meta URLs: ${uncheckedMeta.length} checked, ${metaBroken} broken` });
            }
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : "Navigation failed";
          sendEvent({ type: "log", message: `${wTag}⚠️ Navigation failed, trying HEAD request: ${url}` });

          if (!checkedResources.has(url)) {
            checkedResources.add(url);
            const { status, ok } = await checkUrlStatus(url);

            if (ok) {
              sendEvent({ type: "log", message: `${wTag}   ↳ ✓ HEAD request OK [${status}] — page is slow but reachable` });
            } else {
              const effectiveStatus = status > 0 ? status : 0;
              const references = getLinkReferences(url);
              if (references.length > 0) {
                for (const ref of references) {
                  brokenLinksCount++;
                  sendEvent({
                    type: "broken_link",
                    message: `${wTag}   ↳ ❌ [${effectiveStatus || "Unreachable"}] ${url}`,
                    data: { url, statusCode: effectiveStatus, foundOnPage: ref.foundOnPage, linkText: ref.linkText, elementContext: ref.elementContext, timestamp: new Date().toISOString() } as BrokenLink,
                  });
                }
              } else {
                brokenLinksCount++;
                sendEvent({
                  type: "broken_link",
                  message: `${wTag}   ↳ ❌ [${effectiveStatus || "Unreachable"}] ${url}`,
                  data: { url, statusCode: effectiveStatus, foundOnPage: "[Unknown source]", linkText: "[Unknown]", elementContext: "<unknown>", timestamp: new Date().toISOString() } as BrokenLink,
                });
              }
            }
          }
        }
      }

      let activeWorkers = 0;

      async function worker(workerPage: Page, workerId: number) {
        while (true) {
          const url = queue.shift();
          if (!url) {
            if (activeWorkers === 0) break;
            await new Promise((r) => setTimeout(r, 150));
            continue;
          }
          if (visited.has(url)) continue;
          visited.add(url);
          activeWorkers++;
          await processUrl(workerPage, url, workerId);
          activeWorkers--;
        }
      }

      sendEvent({
        type: "log",
        message: `📋 Queue: ${queue.length} URLs | Starting ${Math.min(concurrency, queue.length)} workers...`,
      });

      await Promise.all(
        pages.map((p, i) => worker(p, i + 1))
      );

      // Close all pages
      for (const p of pages) {
        await p.close();
      }
      await browser.close();
      browser = undefined;

      sendEvent({
        type: "done",
        message: `\n🏁 Crawl complete. Pages: ${visited.size} | Broken Links: ${brokenLinksCount} | Broken Images: ${brokenImagesCount}`,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      sendEvent({
        type: "error",
        message: errMsg,
      });

      if (browser) {
        await browser.close();
      }
    } finally {
      close();
    }
  })();

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
