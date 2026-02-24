import { chromium, Page, Request, Response as PlaywrightResponse } from "playwright";
import { NextRequest } from "next/server";
import { BrokenLink, BrokenImage, ConsoleError, LinkReference } from "../../types/crawler";
import { createSSEResponse, sseHeaders } from "../../../lib/crawler/sse";
import { cleanUrl, isNonHtmlResource, isHashOnlyOrAnchor, shouldSkipExternalCheck } from "../../../lib/crawler/url-utils";
import { IGNORE_ERROR_PATTERNS } from "../../../lib/crawler/constants";
import { checkUrlStatus, fetchXml } from "../../../lib/crawler/http";
import { parseSitemapUrls } from "../../../lib/crawler/sitemap";
import {
  extractLinksWithContext,
  extractImagesWithContext,
  extractMetaUrls,
} from "../../../lib/crawler/extractors";

function shouldIgnoreError(message: string): boolean {
  return IGNORE_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

// Determine resource type from URL or content-type
function getResourceType(
  url: string,
  contentType?: string
): "link" | "image" | "document" | "other" {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    if (parsed.hash && !pathname.match(/\.[a-z0-9]{2,5}$/i)) return "link";
    if (/\.(jpg|jpeg|png|gif|webp|svg|ico|bmp|tiff?)$/i.test(pathname)) return "image";
    if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i.test(pathname)) return "document";
    if (contentType) {
      if (contentType.startsWith("image/")) return "image";
      if (contentType.includes("pdf") || contentType.includes("document")) return "document";
    }
    if (/\.(html?|php|aspx?|jsp)$/i.test(pathname) || !pathname.match(/\.[a-z0-9]{2,5}$/i)) {
      return "link";
    }
    return "other";
  } catch {
    return "link";
  }
}

// Parse 404 status and URL from a browser console error message
function parse404FromConsoleError(message: string): { url: string; status: number } | null {
  if (shouldIgnoreError(message)) return null;
  const statusMatch = message.match(/status of (\d{3})/);
  if (statusMatch) {
    const status = parseInt(statusMatch[1], 10);
    if (status >= 400 && status < 500) {
      const urlMatch = message.match(/(https?:\/\/[^\s]+)/);
      if (urlMatch) return { url: urlMatch[1], status };
    }
  }
  return null;
}

// Handle both GET (legacy/EventSource) and POST (for large payloads)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const startUrl = searchParams.get("startUrl");
  const sitemapUrl = searchParams.get("sitemapUrl");
  const selectedUrlsParam = searchParams.get("selectedUrls");

  if (!startUrl) return new Response("Missing startUrl parameter", { status: 400 });

  let selectedUrls: Set<string> | null = null;
  if (selectedUrlsParam) {
    try {
      const parsed = JSON.parse(decodeURIComponent(selectedUrlsParam));
      if (Array.isArray(parsed)) {
        selectedUrls = new Set(parsed.map((url: string) => cleanUrl(url)));
      }
    } catch { /* invalid JSON, ignore */ }
  }

  return handleCrawl(startUrl, sitemapUrl, selectedUrls);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      startUrl,
      sitemapUrl,
      cssSelector,
      concurrency: concurrencyParam,
      selectedUrls: selectedUrlsArray,
    } = body;

    if (!startUrl) return new Response("Missing startUrl parameter", { status: 400 });

    let selectedUrls: Set<string> | null = null;
    if (Array.isArray(selectedUrlsArray)) {
      selectedUrls = new Set(selectedUrlsArray.map((url: string) => cleanUrl(url)));
    }

    const concurrency = Math.min(Math.max(parseInt(concurrencyParam) || 3, 1), 20);
    return handleCrawl(startUrl, sitemapUrl || null, selectedUrls, cssSelector || undefined, concurrency);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    return new Response(`Invalid request body: ${errMsg}`, { status: 400 });
  }
}

function handleCrawl(
  startUrl: string,
  sitemapUrl: string | null,
  selectedUrls: Set<string> | null,
  cssSelector?: string,
  concurrency: number = 3
) {
  const { stream, sendEvent, close } = createSSEResponse();

  (async () => {
    let browser;

    try {
      sendEvent({
        type: "log",
        message: `🚀 Starting crawler... (${concurrency} parallel worker${concurrency > 1 ? "s" : ""})`,
      });
      if (cssSelector) {
        sendEvent({ type: "log", message: `🎯 CSS selector active: ${cssSelector}` });
      }

      browser = await chromium.launch({ headless: true, args: ["--disable-http2"] });
      const context = await browser.newContext({ ignoreHTTPSErrors: true });

      const pages: Page[] = [];
      for (let i = 0; i < concurrency; i++) {
        pages.push(await context.newPage());
      }

      const visited = new Set<string>();
      const checkedResources = new Set<string>();
      const headerLinksValidated = new Set<string>();
      const allCheckedUrls = new Set<string>();

      const queue: string[] = selectedUrls ? [...selectedUrls] : [startUrl];
      // O(1) membership test for "is this URL already queued?"
      const queuedUrls = new Set<string>(queue);
      const origin = new URL(startUrl).origin;

      const isSelectiveMode = selectedUrls !== null;
      const linkRegistry = new Map<string, LinkReference[]>();

      let totalCrawled = 0;
      let brokenLinksCount = 0;
      let brokenImagesCount = 0;

      const pageCurrentUrl = new Map<Page, string>();

      const registerLink = (url: string, ref: LinkReference) => {
        if (!linkRegistry.has(url)) linkRegistry.set(url, []);
        const refs = linkRegistry.get(url)!;
        if (!refs.some((r) => r.foundOnPage === ref.foundOnPage && r.linkText === ref.linkText)) {
          refs.push(ref);
        }
      };

      const getLinkReferences = (url: string): LinkReference[] =>
        linkRegistry.get(url) || [];

      const reportBrokenLink = (data: BrokenLink) => {
        brokenLinksCount++;
        sendEvent({
          type: "broken_link",
          message: `🔗❌ Broken ${data.statusCode > 0 ? `(${data.statusCode})` : "[Unreachable]"}: ${data.url} | Linked from: ${data.foundOnPage}`,
          data,
        });
      };

      const reportBrokenImage = (data: BrokenImage) => {
        brokenImagesCount++;
        sendEvent({
          type: "broken_image",
          message: `🖼️❌ Broken image${data.reason ? ` (${data.reason})` : ""}: ${data.src}`,
          data,
        });
      };

      // Load sitemap if provided (only in full-crawl mode)
      if (sitemapUrl && !isSelectiveMode) {
        sendEvent({ type: "log", message: `📄 Loading sitemap: ${sitemapUrl}` });
        try {
          const xml = await fetchXml(sitemapUrl);
          const sitemapUrls = parseSitemapUrls(xml).filter((u) => u.startsWith(origin));

          for (const u of sitemapUrls) {
            if (!isNonHtmlResource(u)) {
              if (!queuedUrls.has(u)) {
                queue.push(u);
                queuedUrls.add(u);
              }
            }
            registerLink(u, {
              foundOnPage: sitemapUrl,
              linkText: "[From sitemap]",
              elementContext: "<sitemap>",
            });
          }

          sendEvent({ type: "log", message: `✅ Added ${sitemapUrls.length} URLs from sitemap` });
        } catch (err: unknown) {
          sendEvent({
            type: "log",
            message: `⚠️ Failed to load sitemap: ${err instanceof Error ? err.message : "Unknown error"}`,
          });
        }
      }

      registerLink(startUrl, {
        foundOnPage: "[Start URL]",
        linkText: "[User provided]",
        elementContext: "<input>",
      });

      // ── Event listeners ──────────────────────────────────────────────────────

      function setupPageListeners(workerPage: Page) {
        workerPage.on("response", (response: PlaywrightResponse) => {
          const url = response.url();
          const status = response.status();
          const req = response.request();
          const resourceType = req.resourceType();
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
            reportBrokenImage({
              src: url,
              foundOnPage: currentUrl,
              altText: "[Detected from network]",
              elementContext: `<${resourceType}>`,
              reason: `HTTP ${status} - Resource not found`,
              timestamp: new Date().toISOString(),
            });
          } else if (type === "link" || resourceType === "fetch" || resourceType === "xhr") {
            const references = getLinkReferences(url);
            const refs = references.length > 0
              ? references
              : [{ foundOnPage: currentUrl, linkText: "[Detected from network]", elementContext: `<${resourceType}>` }];
            for (const ref of refs) {
              reportBrokenLink({
                url,
                statusCode: status,
                foundOnPage: ref.foundOnPage,
                linkText: ref.linkText,
                elementContext: ref.elementContext,
                timestamp: new Date().toISOString(),
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

          if (
            shouldIgnoreError(errorText) ||
            errorText.includes("ERR_ABORTED") ||
            errorText.includes("ERR_BLOCKED") ||
            errorText.includes("ERR_FAILED") ||
            errorText.includes("ERR_CACHE") ||
            errorText.includes("ERR_CONNECTION")
          ) return;
          if (resourceType === "document") return;
          if (["stylesheet", "font", "script", "media"].includes(resourceType)) return;
          if (url.toLowerCase().includes(".svg")) return;

          checkedResources.add(url);
          sendEvent({ type: "log", message: `🚫 Request failed: ${url} | Reason: ${errorText} | Page: ${currentUrl}` });

          if (resourceType === "image" && errorText.includes("ERR_NAME_NOT_RESOLVED")) {
            reportBrokenImage({
              src: url,
              foundOnPage: currentUrl,
              altText: "[Detected from network]",
              elementContext: `<${resourceType}>`,
              reason: errorText || "Request failed",
              timestamp: new Date().toISOString(),
            });
          }
        });

        workerPage.on("console", (msg) => {
          if (msg.type() !== "error") return;
          const text = msg.text();
          const currentUrl = pageCurrentUrl.get(workerPage) || startUrl;
          if (shouldIgnoreError(text)) return;

          sendEvent({ type: "log", message: `❌ Console error: ${text} | Page: ${currentUrl}` });
          sendEvent({
            type: "console_error",
            message: `❌ Console error: ${text}`,
            data: {
              message: text,
              foundOnPage: currentUrl,
              type: "error",
              timestamp: new Date().toISOString(),
            } as ConsoleError,
          });

          const parsed = parse404FromConsoleError(text);
          if (!parsed || !parsed.url.startsWith(origin) || checkedResources.has(parsed.url)) return;
          if (isNonHtmlResource(parsed.url) || parsed.url.toLowerCase().includes(".svg")) return;
          checkedResources.add(parsed.url);

          const type = getResourceType(parsed.url);
          if (type === "image" && parsed.status === 404) {
            reportBrokenImage({
              src: parsed.url,
              foundOnPage: currentUrl,
              altText: "[Detected from console]",
              elementContext: "<console-error>",
              reason: `HTTP ${parsed.status} - From console error`,
              timestamp: new Date().toISOString(),
            });
          } else if (type === "link") {
            const references = getLinkReferences(parsed.url);
            const refs = references.length > 0
              ? references
              : [{ foundOnPage: currentUrl, linkText: "[Detected from console]", elementContext: "<console-error>" }];
            for (const ref of refs) {
              reportBrokenLink({
                url: parsed.url,
                statusCode: parsed.status,
                foundOnPage: ref.foundOnPage,
                linkText: ref.linkText,
                elementContext: ref.elementContext,
                timestamp: new Date().toISOString(),
              });
            }
          }
        });

        workerPage.on("pageerror", (err) => {
          const currentUrl = pageCurrentUrl.get(workerPage) || startUrl;
          sendEvent({ type: "log", message: `🔥 JS error: ${err.message} | Page: ${currentUrl}` });
          sendEvent({
            type: "console_error",
            message: `🔥 JS error: ${err.message}`,
            data: {
              message: err.message,
              foundOnPage: currentUrl,
              type: "js_error",
              timestamp: new Date().toISOString(),
            } as ConsoleError,
          });
        });
      }

      for (const workerPage of pages) {
        setupPageListeners(workerPage);
      }

      // ── processUrl ───────────────────────────────────────────────────────────

      async function processUrl(workerPage: Page, url: string, workerId: number) {
        if (isNonHtmlResource(url)) {
          const references = getLinkReferences(url);
          if (references.length > 0 && !checkedResources.has(url)) {
            const { status, ok } = await checkUrlStatus(url);
            checkedResources.add(url);
            allCheckedUrls.add(url);
            if (!ok && status >= 400) {
              for (const ref of references) {
                reportBrokenLink({
                  url,
                  statusCode: status,
                  foundOnPage: ref.foundOnPage,
                  linkText: ref.linkText,
                  elementContext: ref.elementContext,
                  timestamp: new Date().toISOString(),
                });
              }
            }
          }
          return;
        }

        totalCrawled++;
        allCheckedUrls.add(url);
        pageCurrentUrl.set(workerPage, url);
        const wTag = concurrency > 1 ? `[W${workerId}] ` : "";

        sendEvent({ type: "log", message: `\n${wTag}🔍 Crawling (${totalCrawled}): ${url}` });

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
              const isRetryable =
                /ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED|ERR_TIMED_OUT|ERR_HTTP2|ERR_NETWORK_CHANGED|ERR_SOCKET_NOT_CONNECTED/.test(
                  msg
                );
              if (isRetryable && attempt < MAX_RETRIES) {
                sendEvent({ type: "log", message: `${wTag}⚠️ Retry ${attempt}/${MAX_RETRIES} for ${url}` });
                await new Promise((r) => setTimeout(r, 2000 * attempt));
                continue;
              }
              throw navErr;
            }
          }

          await workerPage.waitForTimeout(2000);

          // Page itself returned 4xx/5xx
          if (response && response.status() >= 400) {
            const status = response.status();
            sendEvent({ type: "log", message: `${wTag}⚠️ Page returned ${status}: ${url}` });
            if (!checkedResources.has(url)) {
              checkedResources.add(url);
              const references = getLinkReferences(url);
              const refs = references.length > 0
                ? references
                : [{ foundOnPage: "[Unknown source]", linkText: "[Unknown]", elementContext: "<unknown>" }];
              for (const ref of refs) {
                reportBrokenLink({
                  url,
                  statusCode: status,
                  foundOnPage: ref.foundOnPage,
                  linkText: ref.linkText,
                  elementContext: ref.elementContext,
                  timestamp: new Date().toISOString(),
                });
              }
            }
            return;
          }

          // ── Extract and classify internal links ──────────────────────────────

          const links = await extractLinksWithContext(workerPage, cssSelector);
          const internalLinks = links
            .filter((l) => l.href.startsWith(origin))
            .filter((l) => !isHashOnlyOrAnchor(l.href));

          const headerLinks = internalLinks.filter((l) => l.isInHeader);
          const contentLinks = internalLinks.filter((l) => !l.isInHeader);
          const allExternalLinks = links.filter((l) => {
            try {
              const linkUrl = new URL(l.href);
              return (
                (linkUrl.protocol === "http:" || linkUrl.protocol === "https:") &&
                !l.href.startsWith(origin)
              );
            } catch {
              return false;
            }
          });

          sendEvent({
            type: "log",
            message: `${wTag}🔗 Found ${links.length} links (${internalLinks.length} internal: ${contentLinks.length} content, ${headerLinks.length} header/nav | ${allExternalLinks.length} external)`,
          });

          // Links that need a HEAD check on this page (selective mode only)
          const linksToValidate: Array<{ url: string; text: string; context: string }> = [];
          const headerLinksToValidate: Array<{ url: string; text: string; context: string }> = [];
          let skippedAlreadyVisited = 0;
          let addedToQueue = 0;

          for (const link of internalLinks) {
            const cleanedUrl = cleanUrl(link.href);

            if (link.isInHeader) {
              // Validate each unique header/nav URL exactly once across all pages
              if (
                !headerLinksValidated.has(cleanedUrl) &&
                !visited.has(cleanedUrl) &&
                !queuedUrls.has(cleanedUrl) &&
                !checkedResources.has(cleanedUrl)
              ) {
                headerLinksValidated.add(cleanedUrl);
                registerLink(cleanedUrl, {
                  foundOnPage: url,
                  linkText: link.text,
                  elementContext: link.context,
                });
                headerLinksToValidate.push({ url: cleanedUrl, text: link.text, context: link.context });
              }
              continue;
            }

            registerLink(cleanedUrl, {
              foundOnPage: url,
              linkText: link.text,
              elementContext: link.context,
            });

            if (!isSelectiveMode) {
              if (!visited.has(cleanedUrl) && !queuedUrls.has(cleanedUrl)) {
                queue.push(cleanedUrl);
                queuedUrls.add(cleanedUrl);
                addedToQueue++;
              }
            } else {
              // Selective mode: decide whether to validate or skip
              if (visited.has(cleanedUrl) || checkedResources.has(cleanedUrl)) {
                skippedAlreadyVisited++;
              } else if (selectedUrls?.has(cleanedUrl)) {
                // Already queued for full crawl — will be reported if broken when visited
              } else if (!queuedUrls.has(cleanedUrl)) {
                // BUG FIX: Previously, links in allDiscoveredUrls were silently skipped.
                // Now all unvisited/unchecked inner links are validated via HEAD request,
                // regardless of whether they appear in the sitemap.
                linksToValidate.push({ url: cleanedUrl, text: link.text, context: link.context });
              }
            }
          }

          if (isSelectiveMode) {
            const parts: string[] = [];
            if (linksToValidate.length > 0) parts.push(`${linksToValidate.length} to validate`);
            if (skippedAlreadyVisited > 0) parts.push(`${skippedAlreadyVisited} already checked`);
            if (headerLinksToValidate.length > 0) parts.push(`${headerLinksToValidate.length} nav/header to check`);
            if (parts.length > 0) {
              sendEvent({ type: "log", message: `${wTag}   ↳ Internal links: ${parts.join(", ")}` });
            }
          } else if (addedToQueue > 0) {
            sendEvent({ type: "log", message: `${wTag}   ↳ Added ${addedToQueue} new internal links to crawl queue` });
          }

          // ── Validate header/nav links (once per unique URL across all pages) ─

          if (headerLinksToValidate.length > 0) {
            sendEvent({
              type: "log",
              message: `${wTag}🧭 Checking ${headerLinksToValidate.length} new nav/header link${headerLinksToValidate.length > 1 ? "s" : ""}...`,
            });
            for (const link of headerLinksToValidate) {
              const { status, ok } = await checkUrlStatus(link.url);
              allCheckedUrls.add(link.url);
              if (!ok || status === 0) {
                reportBrokenLink({
                  url: link.url,
                  statusCode: status,
                  foundOnPage: url,
                  linkText: link.text,
                  elementContext: link.context,
                  timestamp: new Date().toISOString(),
                });
                sendEvent({
                  type: "log",
                  message: `${wTag}   ↳ ❌ [${status || "Unreachable"}] ${link.url}`,
                });
              }
            }
          }

          // ── Validate inner links not in the crawl queue (selective mode) ─────

          if (linksToValidate.length > 0) {
            const total = linksToValidate.length;
            sendEvent({ type: "log", message: `${wTag}🔎 Validating ${total} links not in crawl queue...` });
            let validatedCount = 0;
            let brokenCount = 0;
            let skippedCount = 0;

            for (let i = 0; i < linksToValidate.length; i++) {
              const link = linksToValidate[i];
              if (checkedResources.has(link.url)) { skippedCount++; continue; }
              checkedResources.add(link.url);
              sendEvent({ type: "log", message: `${wTag}   ↳ [${i + 1}/${total}] Checking: ${link.url}` });

              const { status, ok } = await checkUrlStatus(link.url);
              validatedCount++;
              allCheckedUrls.add(link.url);

              if (!ok && status >= 400) {
                brokenCount++;
                reportBrokenLink({
                  url: link.url,
                  statusCode: status,
                  foundOnPage: url,
                  linkText: link.text,
                  elementContext: link.context,
                  timestamp: new Date().toISOString(),
                });
                sendEvent({ type: "log", message: `${wTag}   ↳ ❌ [${status}] ${link.url}` });
              } else if (status === 0) {
                brokenCount++;
                reportBrokenLink({
                  url: link.url,
                  statusCode: 0,
                  foundOnPage: url,
                  linkText: link.text,
                  elementContext: link.context,
                  timestamp: new Date().toISOString(),
                });
                sendEvent({ type: "log", message: `${wTag}   ↳ ❌ [Unreachable] ${link.url}` });
              } else {
                sendEvent({ type: "log", message: `${wTag}   ↳ ✓ [${status}] OK` });
              }
            }

            sendEvent({
              type: "log",
              message: `${wTag}✅ Link validation complete: ${validatedCount} checked, ${brokenCount} broken${skippedCount > 0 ? `, ${skippedCount} skipped (already checked)` : ""}`,
            });
          }

          // ── Check external links ──────────────────────────────────────────────

          const externalLinks = links
            .filter((l) => {
              try {
                const linkUrl = new URL(l.href);
                return (
                  (linkUrl.protocol === "http:" || linkUrl.protocol === "https:") &&
                  !l.href.startsWith(origin)
                );
              } catch {
                return false;
              }
            })
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
              allCheckedUrls.add(link.href);

              if (!ok && status >= 400) {
                externalBroken++;
                reportBrokenLink({
                  url: link.href,
                  statusCode: status,
                  foundOnPage: url,
                  linkText: link.text,
                  elementContext: link.context,
                  timestamp: new Date().toISOString(),
                });
                sendEvent({ type: "log", message: `${wTag}   ↳ ❌ [${status}] ${link.href}` });
              } else if (status === 0) {
                externalBroken++;
                reportBrokenLink({
                  url: link.href,
                  statusCode: 0,
                  foundOnPage: url,
                  linkText: link.text,
                  elementContext: link.context,
                  timestamp: new Date().toISOString(),
                });
                sendEvent({ type: "log", message: `${wTag}   ↳ ❌ [Unreachable] ${link.href}` });
              } else {
                sendEvent({ type: "log", message: `${wTag}   ↳ ✓ [${status}] OK` });
              }
            }

            sendEvent({
              type: "log",
              message: `${wTag}✅ External links: ${externalChecked} checked, ${externalBroken} broken`,
            });
          }

          // ── Check images ──────────────────────────────────────────────────────

          const images = await extractImagesWithContext(workerPage, cssSelector);
          sendEvent({ type: "log", message: `${wTag}🖼️ Found ${images.length} images` });

          for (const img of images) {
            if (!img.src || checkedResources.has(img.src)) continue;
            if (
              img.src === "#" ||
              img.src.endsWith("#") ||
              img.src.startsWith("data:") ||
              img.src.startsWith("blob:") ||
              img.src === url ||
              !img.src.startsWith("http")
            ) continue;

            allCheckedUrls.add(img.src);
            const isSvg = img.src.toLowerCase().includes(".svg");
            let isBroken = false;
            let reason = "";

            if (!img.complete) {
              isBroken = true;
              reason = "Image failed to load (incomplete)";
            } else if (img.naturalWidth === 0 && !isSvg) {
              isBroken = true;
              reason = "Image has zero width (failed to load)";
            }

            if (isBroken && img.src.startsWith(origin)) {
              try {
                const headResult = await checkUrlStatus(img.src);
                if (headResult.ok || (headResult.status >= 200 && headResult.status < 400)) {
                  isBroken = false;
                }
              } catch { /* HEAD request failed, keep isBroken=true */ }
            }

            if (isBroken) {
              checkedResources.add(img.src);
              reportBrokenImage({
                src: img.src,
                foundOnPage: url,
                altText: img.alt,
                elementContext: img.context,
                reason,
                timestamp: new Date().toISOString(),
              });
            }
          }

          // ── Check meta/source URLs ────────────────────────────────────────────

          const metaUrls = await extractMetaUrls(workerPage);
          const uncheckedMeta = metaUrls.filter((m) => !checkedResources.has(m.url));
          if (uncheckedMeta.length > 0) {
            sendEvent({ type: "log", message: `${wTag}📄 Found ${uncheckedMeta.length} meta/source URLs to verify` });
            let metaBroken = 0;
            for (const meta of uncheckedMeta) {
              checkedResources.add(meta.url);
              allCheckedUrls.add(meta.url);
              const { status, ok } = await checkUrlStatus(meta.url);
              if (!ok && (status >= 400 || status === 0)) {
                metaBroken++;
                reportBrokenLink({
                  url: meta.url,
                  statusCode: status,
                  foundOnPage: url,
                  linkText: meta.context,
                  elementContext: meta.context,
                  timestamp: new Date().toISOString(),
                });
                sendEvent({
                  type: "log",
                  message: `${wTag}   ↳ ❌ [${status || "Unreachable"}] ${meta.url} (${meta.context})`,
                });
              }
            }
            if (metaBroken > 0) {
              sendEvent({
                type: "log",
                message: `${wTag}📄 Meta URLs: ${uncheckedMeta.length} checked, ${metaBroken} broken`,
              });
            }
          }
        } catch {
          sendEvent({ type: "log", message: `${wTag}⚠️ Navigation failed, trying HEAD request: ${url}` });

          if (!checkedResources.has(url)) {
            checkedResources.add(url);
            allCheckedUrls.add(url);
            const { status, ok } = await checkUrlStatus(url);

            if (ok) {
              sendEvent({ type: "log", message: `${wTag}   ↳ ✓ HEAD request OK [${status}] — page is slow but reachable` });
            } else {
              const references = getLinkReferences(url);
              const refs = references.length > 0
                ? references
                : [{ foundOnPage: "[Unknown source]", linkText: "[Unknown]", elementContext: "<unknown>" }];
              for (const ref of refs) {
                reportBrokenLink({
                  url,
                  statusCode: status,
                  foundOnPage: ref.foundOnPage,
                  linkText: ref.linkText,
                  elementContext: ref.elementContext,
                  timestamp: new Date().toISOString(),
                });
              }
              sendEvent({ type: "log", message: `${wTag}   ↳ ❌ [${status || "Unreachable"}] ${url}` });
            }
          }
        }
      }

      // ── Worker loop ───────────────────────────────────────────────────────────

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
          sendEvent({ type: "links_checked", count: allCheckedUrls.size });
        }
      }

      sendEvent({
        type: "log",
        message: `📋 Queue: ${queue.length} URLs | Starting ${Math.min(concurrency, queue.length)} workers...`,
      });

      await Promise.all(pages.map((p, i) => worker(p, i + 1)));

      for (const p of pages) await p.close();
      await browser.close();
      browser = undefined;

      sendEvent({
        type: "done",
        message: `\n🏁 Crawl complete. Pages: ${visited.size} | Broken Links: ${brokenLinksCount} | Broken Images: ${brokenImagesCount}`,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      sendEvent({ type: "error", message: errMsg });
      if (browser) await browser.close();
    } finally {
      close();
    }
  })();

  return new Response(stream, { headers: sseHeaders() });
}
