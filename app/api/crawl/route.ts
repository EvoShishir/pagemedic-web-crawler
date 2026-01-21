import { chromium, Page, Request, Response as PlaywrightResponse } from "playwright";
import { NextRequest } from "next/server";
import https from "https";
import http from "http";
import { BrokenLink, BrokenImage, ConsoleError, NavigationIssue } from "../../types/crawler";

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
    const { startUrl, sitemapUrl, cssSelector, selectedUrls: selectedUrlsArray, allDiscoveredUrls: allDiscoveredArray } = body;

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

    return handleCrawl(startUrl, sitemapUrl || null, selectedUrls, allDiscoveredUrls, cssSelector || undefined);
  } catch (err: any) {
    return new Response(`Invalid request body: ${err.message}`, { status: 400 });
  }
}

function handleCrawl(
  startUrl: string,
  sitemapUrl: string | null,
  selectedUrls: Set<string> | null,
  allDiscoveredUrls: Set<string> | null = null,
  cssSelector?: string
) {

  const { stream, sendEvent, close } = createSSEResponse();

  // Start crawling in the background
  (async () => {
    let browser;

    try {
      sendEvent({ type: "log", message: "🚀 Starting crawler..." });
      if (cssSelector) {
        sendEvent({ type: "log", message: `🎯 CSS selector active: ${cssSelector}` });
      }

      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        ignoreHTTPSErrors: true, // Allow self-signed certificates
      });
      const page = await context.newPage();

      const visited = new Set<string>();
      const checkedResources = new Set<string>();
      
      // If selectedUrls is provided, use those; otherwise start with startUrl
      const queue: string[] = selectedUrls ? [...selectedUrls] : [startUrl];
      const origin = new URL(startUrl).origin;
      
      // Flag to indicate if we're in selective mode (user pre-selected URLs)
      const isSelectiveMode = selectedUrls !== null;

      // Track where each URL was discovered (referrer tracking)
      // Map: URL -> array of references (pages that link to this URL)
      const linkRegistry = new Map<string, LinkReference[]>();

      let totalCrawled = 0;
      let brokenLinksCount = 0;
      let brokenImagesCount = 0;
      let navigationIssuesCount = 0;
      const BATCH_SIZE = 100;

      // Track current page URL for context
      let currentPageUrl = startUrl;
      
      // Track if this is the first page (for header link handling)
      let isFirstPage = true;
      
      // Flag to check if sitemap was provided (affects header link behavior)
      const hasSitemap = !!sitemapUrl;

      // Helper to register a link reference
      const registerLink = (url: string, ref: LinkReference) => {
        if (!linkRegistry.has(url)) {
          linkRegistry.set(url, []);
        }
        const refs = linkRegistry.get(url)!;
        // Avoid duplicate references from same page
        if (!refs.some(r => r.foundOnPage === ref.foundOnPage && r.linkText === ref.linkText)) {
          refs.push(ref);
        }
      };

      // Helper to get link references for a URL
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
            // Only queue HTML pages, not resources
            if (!isNonHtmlResource(u)) {
              queue.push(u);
            }
            // Register sitemap as the source
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
        } catch (err: any) {
          sendEvent({
            type: "log",
            message: `⚠️ Failed to load sitemap: ${err.message}`,
          });
        }
      }

      // Register start URL
      registerLink(startUrl, {
        foundOnPage: "[Start URL]",
        linkText: "[User provided]",
        elementContext: "<input>",
      });

      // Listen for failed network requests (catches 404s, 500s, etc.)
      // Only for sub-resources, not main document navigations
      page.on("response", (response: PlaywrightResponse) => {
        const url = response.url();
        const status = response.status();
        const request = response.request();
        const resourceType = request.resourceType();

        // Only track internal resources with error status codes
        if (!url.startsWith(origin)) return;
        if (status < 400) return;
        if (checkedResources.has(url)) return;
        
        // Skip main document navigations - handled in main loop with proper referrer tracking
        if (resourceType === "document") {
          return;
        }
        
        // Skip non-essential resource types (CSS, fonts, etc.)
        if (["stylesheet", "font", "script", "media"].includes(resourceType)) {
          return;
        }
        
        // Skip SVG images - they can report false errors
        if (url.toLowerCase().includes(".svg")) {
          return;
        }
        
        checkedResources.add(url);

        const contentType = response.headers()["content-type"] || "";
        const type = getResourceType(url, contentType);

        // Skip documents like PDFs - they're handled separately
        if (type === "document") {
          return;
        }

        // Only report images with genuine 404/500 errors
        if ((type === "image" || resourceType === "image") && status >= 400) {
          brokenImagesCount++;
          const brokenImage: BrokenImage = {
            src: url,
            foundOnPage: currentPageUrl,
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
          // For fetch/xhr requests, use the link registry if available
          const references = getLinkReferences(url);
          if (references.length > 0) {
            for (const ref of references) {
              brokenLinksCount++;
              const brokenLink: BrokenLink = {
                url: url,
                statusCode: status,
                foundOnPage: ref.foundOnPage,
                linkText: ref.linkText,
                elementContext: ref.elementContext,
                timestamp: new Date().toISOString(),
              };
              sendEvent({
                type: "broken_link",
                message: `🔗❌ Broken resource (${status}): ${url} | Linked from: ${ref.foundOnPage}`,
                data: brokenLink,
              });
            }
          } else {
            brokenLinksCount++;
            const brokenLink: BrokenLink = {
              url: url,
              statusCode: status,
              foundOnPage: currentPageUrl,
              linkText: "[Detected from network]",
              elementContext: `<${resourceType}>`,
              timestamp: new Date().toISOString(),
            };
            sendEvent({
              type: "broken_link",
              message: `🔗❌ Broken resource (${status}): ${url}`,
              data: brokenLink,
            });
          }
        }
      });

      // Set up request failed listener - only for critical failures
      page.on("requestfailed", (request: Request) => {
        const url = request.url();
        if (!url.startsWith(origin)) return;
        if (checkedResources.has(url)) return;

        const failure = request.failure();
        const errorText = failure?.errorText || "";
        const resourceType = request.resourceType();

        // Ignore aborted, blocked, and other non-critical errors
        if (shouldIgnoreError(errorText) || 
            errorText.includes("ERR_ABORTED") || 
            errorText.includes("ERR_BLOCKED") ||
            errorText.includes("ERR_FAILED") ||
            errorText.includes("ERR_CACHE") ||
            errorText.includes("ERR_CONNECTION")) {
          return;
        }
        
        // Skip main document navigations - handled in main loop
        if (resourceType === "document") {
          return;
        }
        
        // Skip non-essential resource types
        if (["stylesheet", "font", "script", "media"].includes(resourceType)) {
          return;
        }

        // Skip SVG images - they often fail to load but are valid
        if (url.toLowerCase().includes(".svg")) {
          return;
        }

        checkedResources.add(url);

        sendEvent({
          type: "log",
          message: `🚫 Request failed: ${url} | Reason: ${errorText} | Page: ${currentPageUrl}`,
        });

        // Add to broken resources based on type - but only for confirmed errors
        if (resourceType === "image" && errorText.includes("ERR_NAME_NOT_RESOLVED")) {
          brokenImagesCount++;
          const brokenImage: BrokenImage = {
            src: url,
            foundOnPage: currentPageUrl,
            altText: "[Detected from network]",
            elementContext: `<${resourceType}>`,
            reason: errorText || "Request failed",
            timestamp: new Date().toISOString(),
          };
          sendEvent({
            type: "broken_image",
            message: `🖼️❌ Broken image: ${url}`,
            data: brokenImage,
          });
        }
      });

      // Listen for console errors to catch 404s - but filter noise
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          const text = msg.text();
          
          // Skip CORS and other ignorable errors
          if (shouldIgnoreError(text)) {
            return;
          }
          
          // Send to activity log
          sendEvent({
            type: "log",
            message: `❌ Console error: ${text} | Page: ${currentPageUrl}`,
          });
          
          // Also send as console_error event for dedicated panel
          const consoleError: ConsoleError = {
            message: text,
            foundOnPage: currentPageUrl,
            type: "error",
            timestamp: new Date().toISOString(),
          };
          sendEvent({
            type: "console_error",
            message: `❌ Console error: ${text}`,
            data: consoleError,
          });

          // Try to parse 404 from console error
          const parsed = parse404FromConsoleError(text);
          if (parsed && parsed.url.startsWith(origin) && !checkedResources.has(parsed.url)) {
            // Skip non-HTML resources - they're handled via HEAD requests
            if (isNonHtmlResource(parsed.url)) {
              return;
            }
            
            // Skip SVG images - they can report false errors
            if (parsed.url.toLowerCase().includes(".svg")) {
              return;
            }
            
            checkedResources.add(parsed.url);
            
            const type = getResourceType(parsed.url);
            
            // Only report images with genuine 404 errors (not other status codes)
            if (type === "image" && parsed.status === 404) {
              brokenImagesCount++;
              const brokenImage: BrokenImage = {
                src: parsed.url,
                foundOnPage: currentPageUrl,
                altText: "[Detected from console]",
                elementContext: "<console-error>",
                reason: `HTTP ${parsed.status} - From console error`,
                timestamp: new Date().toISOString(),
              };
              sendEvent({
                type: "broken_image",
                message: `🖼️❌ Broken image (${parsed.status}): ${parsed.url.slice(0, 80)}...`,
                data: brokenImage,
              });
            } else if (type === "link") {
              // Use link registry if available for better source tracking
              const references = getLinkReferences(parsed.url);
              if (references.length > 0) {
                for (const ref of references) {
                  brokenLinksCount++;
                  const brokenLink: BrokenLink = {
                    url: parsed.url,
                    statusCode: parsed.status,
                    foundOnPage: ref.foundOnPage,
                    linkText: ref.linkText,
                    elementContext: ref.elementContext,
                    timestamp: new Date().toISOString(),
                  };
                  sendEvent({
                    type: "broken_link",
                    message: `🔗❌ Broken resource (${parsed.status}): ${parsed.url} | Linked from: ${ref.foundOnPage}`,
                    data: brokenLink,
                  });
                }
              } else {
                brokenLinksCount++;
                const brokenLink: BrokenLink = {
                  url: parsed.url,
                  statusCode: parsed.status,
                  foundOnPage: currentPageUrl,
                  linkText: "[Detected from console]",
                  elementContext: "<console-error>",
                  timestamp: new Date().toISOString(),
                };
                sendEvent({
                  type: "broken_link",
                  message: `🔗❌ Broken resource (${parsed.status}): ${parsed.url}`,
                  data: brokenLink,
                });
              }
            }
          }
        }
      });

      page.on("pageerror", (err) => {
        sendEvent({
          type: "log",
          message: `🔥 JS error: ${err.message} | Page: ${currentPageUrl}`,
        });
        
        // Also send as console_error event for dedicated panel
        const consoleError: ConsoleError = {
          message: err.message,
          foundOnPage: currentPageUrl,
          type: "js_error",
          timestamp: new Date().toISOString(),
        };
        sendEvent({
          type: "console_error",
          message: `🔥 JS error: ${err.message}`,
          data: consoleError,
        });
      });

      // Crawl loop
      while (queue.length) {
        let batchCount = 0;

        while (queue.length && batchCount < BATCH_SIZE) {
          const url = queue.shift();

          if (!url || visited.has(url)) continue;
          
          // Skip non-HTML resources (PDFs, images, etc.)
          if (isNonHtmlResource(url)) {
            // Check if the resource exists with a HEAD request
            const references = getLinkReferences(url);
            if (references.length > 0 && !checkedResources.has(url)) {
              const { status, ok } = await checkUrlStatus(url);
              checkedResources.add(url);
              
              if (!ok && status >= 400) {
                // Resource is broken
                for (const ref of references) {
                  brokenLinksCount++;
                  const brokenLink: BrokenLink = {
                    url: url,
                    statusCode: status,
                    foundOnPage: ref.foundOnPage,
                    linkText: ref.linkText,
                    elementContext: ref.elementContext,
                    timestamp: new Date().toISOString(),
                  };
                  sendEvent({
                    type: "broken_link",
                    message: `🔗❌ Broken resource (${status}): ${url} | Linked from: ${ref.foundOnPage}`,
                    data: brokenLink,
                  });
                }
              } else {
                sendEvent({
                  type: "log",
                  message: `📄 Resource OK: ${url}`,
                });
              }
            }
            visited.add(url);
            continue;
          }
          
          visited.add(url);
          totalCrawled++;
          batchCount++;
          currentPageUrl = url;

          sendEvent({
            type: "log",
            message: `\n🔍 Crawling (${totalCrawled}): ${url}`,
          });

          try {
            const response = await page.goto(url, {
              waitUntil: "domcontentloaded", // Faster than networkidle, avoids timeout on slow resources
              timeout: 30000,
            });
            
            // Wait a bit for dynamic content, but don't block on slow resources
            await page.waitForTimeout(2000);

            // Check if the page itself is a 404
            if (response && response.status() >= 400) {
              const status = response.status();
              sendEvent({
                type: "log",
                message: `⚠️ Page returned ${status}: ${url}`,
              });

              // Get all pages that linked to this broken page
              const references = getLinkReferences(url);
              
              if (!checkedResources.has(url)) {
                checkedResources.add(url);
                
                // Create a broken link entry for EACH page that links to this URL
                if (references.length > 0) {
                  for (const ref of references) {
                    brokenLinksCount++;
                    const brokenLink: BrokenLink = {
                      url: url,
                      statusCode: status,
                      foundOnPage: ref.foundOnPage,
                      linkText: ref.linkText,
                      elementContext: ref.elementContext,
                      timestamp: new Date().toISOString(),
                    };
                    sendEvent({
                      type: "broken_link",
                      message: `🔗❌ Broken page (${status}): ${url} | Linked from: ${ref.foundOnPage}`,
                      data: brokenLink,
                    });
                  }
                } else {
                  // No reference found (shouldn't happen normally)
                  brokenLinksCount++;
                  const brokenLink: BrokenLink = {
                    url: url,
                    statusCode: status,
                    foundOnPage: "[Unknown source]",
                    linkText: "[Unknown]",
                    elementContext: "<unknown>",
                    timestamp: new Date().toISOString(),
                  };
                  sendEvent({
                    type: "broken_link",
                    message: `🔗❌ Broken page (${status}): ${url}`,
                    data: brokenLink,
                  });
                }
              }
              
              // Skip extracting links from 404 pages
              continue;
            }

            // Extract and check all links on the page (scoped to CSS selector if provided)
            const links = await extractLinksWithContext(page, cssSelector);
            const internalLinks = links
              .filter((l) => l.href.startsWith(origin))
              .filter((l) => !isHashOnlyOrAnchor(l.href)); // Skip hash-only anchors

            // Count header vs non-header links for logging
            const headerLinks = internalLinks.filter((l) => l.isInHeader);
            const contentLinks = internalLinks.filter((l) => !l.isInHeader);
            
            // Count external links
            const allExternalLinks = links.filter((l) => {
              try {
                const linkUrl = new URL(l.href);
                return (linkUrl.protocol === "http:" || linkUrl.protocol === "https:") && 
                       !l.href.startsWith(origin);
              } catch {
                return false;
              }
            });

            sendEvent({
              type: "log",
              message: `🔗 Found ${links.length} links (${internalLinks.length} internal: ${contentLinks.length} content, ${headerLinks.length} header/nav | ${allExternalLinks.length} external)`,
            });

            // Collect links to validate (links that won't be crawled but need checking)
            const linksToValidate: Array<{ url: string; text: string; context: string }> = [];
            let skippedHeaderLinks = 0;
            let skippedAlreadyVisited = 0;
            let skippedInSitemap = 0;
            let addedToQueue = 0;

            // Register and queue internal links
            for (const link of internalLinks) {
              // Clean URL by removing hash fragments
              const cleanedUrl = cleanUrl(link.href);
              
              // Handle header/nav links specially:
              // - If sitemap provided: skip header links entirely (don't check, don't queue)
              // - If no sitemap: only add header links to queue from first page
              if (link.isInHeader) {
                if (hasSitemap) {
                  // Skip header links when sitemap is provided (nav rarely breaks)
                  skippedHeaderLinks++;
                  continue;
                } else if (!isFirstPage) {
                  // No sitemap, but not first page - skip header links
                  skippedHeaderLinks++;
                  continue;
                }
                // No sitemap + first page: fall through to add to queue
              }
              
              // Register where this link was found (for broken link tracking)
              registerLink(cleanedUrl, {
                foundOnPage: url,
                linkText: link.text,
                elementContext: link.context,
              });
              
              // Only add to queue if not in selective mode (user didn't pre-select URLs)
              // In selective mode, only crawl the URLs the user selected
              if (!isSelectiveMode && !visited.has(cleanedUrl) && !queue.includes(cleanedUrl)) {
                queue.push(cleanedUrl);
                addedToQueue++;
              } else if (isSelectiveMode) {
                // In selective mode, check if we should validate this link
                if (visited.has(cleanedUrl) || checkedResources.has(cleanedUrl)) {
                  skippedAlreadyVisited++;
                } else if (selectedUrls?.has(cleanedUrl)) {
                  // Will be crawled as part of selection - skip
                } else if (allDiscoveredUrls?.has(cleanedUrl)) {
                  // In sitemap, assume it's valid
                  skippedInSitemap++;
                } else if (!queue.includes(cleanedUrl)) {
                  // Not in sitemap, not selected, not visited - validate it
                  linksToValidate.push({
                    url: cleanedUrl,
                    text: link.text,
                    context: link.context,
                  });
                }
              }
            }

            // Log what happened to the internal links
            if (isSelectiveMode) {
              const parts = [];
              if (linksToValidate.length > 0) parts.push(`${linksToValidate.length} to validate`);
              if (skippedInSitemap > 0) parts.push(`${skippedInSitemap} in sitemap (assumed valid)`);
              if (skippedAlreadyVisited > 0) parts.push(`${skippedAlreadyVisited} already checked`);
              if (skippedHeaderLinks > 0) parts.push(`${skippedHeaderLinks} header/nav skipped`);
              if (parts.length > 0) {
                sendEvent({
                  type: "log",
                  message: `   ↳ Internal links: ${parts.join(", ")}`,
                });
              }
            } else if (addedToQueue > 0) {
              sendEvent({
                type: "log",
                message: `   ↳ Added ${addedToQueue} new internal links to crawl queue`,
              });
            }
            
            // Mark first page as done after processing
            if (isFirstPage) {
              isFirstPage = false;
            }

            // Validate links that won't be crawled (in selective/sitemap mode)
            if (linksToValidate.length > 0) {
              const totalToValidate = linksToValidate.length;
              sendEvent({
                type: "log",
                message: `🔎 Validating ${totalToValidate} links not in crawl queue...`,
              });

              let validatedCount = 0;
              let brokenCount = 0;
              let skippedCount = 0;

              for (let i = 0; i < linksToValidate.length; i++) {
                const link = linksToValidate[i];
                
                if (checkedResources.has(link.url)) {
                  skippedCount++;
                  continue;
                }
                checkedResources.add(link.url);
                
                // Show which link is being checked
                sendEvent({
                  type: "log",
                  message: `   ↳ [${i + 1}/${totalToValidate}] Checking: ${link.url}`,
                });

                const { status, ok } = await checkUrlStatus(link.url);
                validatedCount++;

                if (!ok && status >= 400) {
                  brokenCount++;
                  brokenLinksCount++;
                  const brokenLink: BrokenLink = {
                    url: link.url,
                    statusCode: status,
                    foundOnPage: url,
                    linkText: link.text,
                    elementContext: link.context,
                    timestamp: new Date().toISOString(),
                  };
                  sendEvent({
                    type: "broken_link",
                    message: `   ↳ ❌ [${status}] ${link.url}`,
                    data: brokenLink,
                  });
                } else if (status === 0) {
                  // Connection failed / timeout - report as navigation issue
                  navigationIssuesCount++;
                  const navIssue: NavigationIssue = {
                    url: link.url,
                    reason: "Connection failed or timeout",
                    foundOnPage: url,
                    linkText: link.text,
                    elementContext: link.context,
                    timestamp: new Date().toISOString(),
                  };
                  sendEvent({
                    type: "navigation_issue",
                    message: `   ↳ ⚠️ [Timeout] ${link.url}`,
                    data: navIssue,
                  });
                } else {
                  // Link is OK - show success status
                  sendEvent({
                    type: "log",
                    message: `   ↳ ✓ [${status}] OK`,
                  });
                }
              }

              sendEvent({
                type: "log",
                message: `✅ Link validation complete: ${validatedCount} checked, ${brokenCount} broken${skippedCount > 0 ? `, ${skippedCount} skipped (already checked)` : ""}`,
              });
            }

            // Check external links for broken links
            const externalLinks = links
              .filter((l) => {
                try {
                  const linkUrl = new URL(l.href);
                  // Must be http/https and not same origin
                  return (linkUrl.protocol === "http:" || linkUrl.protocol === "https:") && 
                         !l.href.startsWith(origin);
                } catch {
                  return false;
                }
              })
              .filter((l) => !l.isInHeader) // Skip header/nav external links (usually social icons)
              .filter((l) => !shouldSkipExternalCheck(l.href)); // Skip social media etc.

            if (externalLinks.length > 0) {
              sendEvent({
                type: "log",
                message: `🌐 Checking ${externalLinks.length} external links...`,
              });

              let externalChecked = 0;
              let externalBroken = 0;

              for (let i = 0; i < externalLinks.length; i++) {
                const link = externalLinks[i];
                
                // Skip if already checked
                if (checkedResources.has(link.href)) {
                  continue;
                }
                checkedResources.add(link.href);

                sendEvent({
                  type: "log",
                  message: `   ↳ [${i + 1}/${externalLinks.length}] Checking: ${link.href}`,
                });

                const { status, ok } = await checkUrlStatus(link.href);
                externalChecked++;

                if (!ok && status >= 400) {
                  externalBroken++;
                  brokenLinksCount++;
                  const brokenLink: BrokenLink = {
                    url: link.href,
                    statusCode: status,
                    foundOnPage: url,
                    linkText: link.text,
                    elementContext: link.context,
                    timestamp: new Date().toISOString(),
                  };
                  sendEvent({
                    type: "broken_link",
                    message: `   ↳ ❌ [${status}] ${link.href}`,
                    data: brokenLink,
                  });
                } else if (status === 0) {
                  // Connection failed / timeout - report as navigation issue for external links
                  navigationIssuesCount++;
                  const navIssue: NavigationIssue = {
                    url: link.href,
                    reason: "Connection failed or timeout (external)",
                    foundOnPage: url,
                    linkText: link.text,
                    elementContext: link.context,
                    timestamp: new Date().toISOString(),
                  };
                  sendEvent({
                    type: "navigation_issue",
                    message: `   ↳ ⚠️ [Timeout] ${link.href}`,
                    data: navIssue,
                  });
                } else {
                  sendEvent({
                    type: "log",
                    message: `   ↳ ✓ [${status}] OK`,
                  });
                }
              }

              sendEvent({
                type: "log",
                message: `✅ External links: ${externalChecked} checked, ${externalBroken} broken`,
              });
            }

            // Extract and check all images on the page (DOM-based check, scoped to CSS selector if provided)
            const images = await extractImagesWithContext(page, cssSelector);
            sendEvent({
              type: "log",
              message: `🖼️ Found ${images.length} images`,
            });

            for (const img of images) {
              // Skip invalid/empty image sources
              if (!img.src || checkedResources.has(img.src)) continue;
              
              // Skip non-URL sources (anchors, data URIs, blob URIs)
              if (img.src === "#" || 
                  img.src.endsWith("#") || 
                  img.src.startsWith("data:") || 
                  img.src.startsWith("blob:") ||
                  img.src === url ||  // Skip self-referencing URLs
                  !img.src.startsWith("http")) {
                continue;
              }
              
              // Check if image failed to load based on DOM properties
              let isBroken = false;
              let reason = "";

              // Skip SVG images from naturalWidth check - they often report 0 even when valid
              const isSvg = img.src.toLowerCase().includes(".svg");
              
              if (!img.complete) {
                isBroken = true;
                reason = "Image failed to load (incomplete)";
              } else if (img.naturalWidth === 0 && !isSvg) {
                // Only flag non-SVG images with zero width
                isBroken = true;
                reason = "Image has zero width (failed to load)";
              }

              // For potentially broken images, verify with a HEAD request
              if (isBroken && img.src.startsWith(origin)) {
                try {
                  const headResult = await checkUrlStatus(img.src);
                  if (headResult.ok || (headResult.status >= 200 && headResult.status < 400)) {
                    // Image actually exists - skip it
                    isBroken = false;
                  }
                } catch {
                  // HEAD request failed, image is likely broken
                }
              }

              if (isBroken) {
                checkedResources.add(img.src);
                brokenImagesCount++;
                const brokenImage: BrokenImage = {
                  src: img.src,
                  foundOnPage: url,
                  altText: img.alt,
                  elementContext: img.context,
                  reason: reason,
                  timestamp: new Date().toISOString(),
                };

                sendEvent({
                  type: "broken_image",
                  message: `🖼️❌ Broken image: ${img.src}`,
                  data: brokenImage,
                });
              }
            }
          } catch (err: any) {
            sendEvent({
              type: "log",
              message: `⚠️ Navigation error: ${err.message} | Page: ${url}`,
            });
            
            // If navigation failed, report as navigation issue (not broken link)
            const references = getLinkReferences(url);
            if (references.length > 0 && !checkedResources.has(url)) {
              checkedResources.add(url);
              for (const ref of references) {
                navigationIssuesCount++;
                const navIssue: NavigationIssue = {
                  url: url,
                  reason: err.message || "Navigation failed",
                  foundOnPage: ref.foundOnPage,
                  linkText: ref.linkText,
                  elementContext: ref.elementContext,
                  timestamp: new Date().toISOString(),
                };
                sendEvent({
                  type: "navigation_issue",
                  message: `⚠️ Navigation issue: ${url} | Reason: ${err.message}`,
                  data: navIssue,
                });
              }
            }
          }

          // Show pages remaining after each page is crawled
          if (queue.length > 0) {
            sendEvent({
              type: "log",
              message: `📋 ${queue.length} pages remaining in queue`,
            });
          }
        }

        sendEvent({
          type: "log",
          message: `\n✅ Batch finished. Total pages crawled: ${totalCrawled}`,
        });

        if (queue.length) {
          sendEvent({
            type: "log",
            message: `📊 ${queue.length} URLs remaining in queue`,
          });
        }
      }

      await browser.close();

      sendEvent({
        type: "done",
        message: `\n🏁 Crawl complete. Pages: ${visited.size} | Broken Links: ${brokenLinksCount} | Broken Images: ${brokenImagesCount} | Nav Issues: ${navigationIssuesCount}`,
      });
    } catch (err: any) {
      sendEvent({
        type: "error",
        message: err.message,
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
