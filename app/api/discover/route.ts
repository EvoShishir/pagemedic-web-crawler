import { chromium, Page } from "playwright";
import { NextRequest } from "next/server";
import https from "https";
import http from "http";

// File extensions that should not be crawled as pages
const NON_HTML_EXTENSIONS = [
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".zip", ".rar", ".7z", ".tar", ".gz",
  ".mp3", ".mp4", ".avi", ".mov", ".wmv", ".wav", ".ogg",
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico", ".bmp", ".tiff",
  ".css", ".js", ".json", ".txt", ".csv",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
];

// Check if URL is a non-HTML resource
function isNonHtmlResource(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return NON_HTML_EXTENSIONS.some((ext) => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

// Clean URL by removing hash
function cleanUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    urlObj.hash = "";
    return urlObj.toString();
  } catch {
    return url;
  }
}

// Fetch XML content from URL
async function fetchXml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = { rejectUnauthorized: false };
    
    const makeRequest = (targetUrl: string, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error("Too many redirects"));
        return;
      }
      
      const reqProtocol = targetUrl.startsWith("https") ? https : http;
      reqProtocol
        .get(targetUrl, options, (res) => {
          // Handle redirects
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const redirectUrl = new URL(res.headers.location, targetUrl).toString();
            makeRequest(redirectUrl, redirectCount + 1);
            return;
          }
          
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
    };
    
    makeRequest(url);
  });
}

// Check if XML is a sitemap index (contains other sitemaps)
function isSitemapIndex(xml: string): boolean {
  return xml.includes("<sitemapindex") || xml.includes("<sitemap>");
}

// Extract sitemap URLs from a sitemap index
function extractSitemapUrls(xml: string): string[] {
  const urls: string[] = [];
  // Match <sitemap>...<loc>URL</loc>...</sitemap> patterns
  const sitemapMatches = xml.match(/<sitemap[^>]*>[\s\S]*?<\/sitemap>/gi) || [];
  for (const match of sitemapMatches) {
    const locMatch = match.match(/<loc>(.*?)<\/loc>/i);
    if (locMatch && locMatch[1]) {
      urls.push(locMatch[1].trim());
    }
  }
  return urls;
}

// Parse sitemap and extract page URLs
function parseSitemapUrls(xml: string): string[] {
  const urls = new Set<string>();
  // Match <url>...<loc>URL</loc>...</url> patterns (not inside <sitemap>)
  const urlMatches = xml.match(/<url[^>]*>[\s\S]*?<\/url>/gi) || [];
  for (const match of urlMatches) {
    const locMatch = match.match(/<loc>(.*?)<\/loc>/i);
    if (locMatch && locMatch[1]) {
      urls.add(locMatch[1].trim());
    }
  }
  
  // Also try simple <loc> extraction for simpler sitemaps
  if (urls.size === 0) {
    const locMatches = xml.match(/<loc>(.*?)<\/loc>/gi) || [];
  for (const match of locMatches) {
      const loc = match.replace(/<\/?loc>/gi, "").trim();
      // Skip sitemap URLs (they contain .xml)
      if (!loc.endsWith(".xml") && !loc.includes("sitemap")) {
    urls.add(loc);
      }
    }
  }
  
  return [...urls];
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

  const sendEvent = (data: object) => {
    if (isClosed) return;
    try {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      controller.enqueue(encoder.encode(message));
    } catch {
      isClosed = true;
    }
  };

  const close = () => {
    if (!isClosed) {
      try {
        controller.close();
        isClosed = true;
      } catch {
        isClosed = true;
      }
    }
  };

  return { stream, sendEvent, close };
}

// Build a scoped selector that handles comma-separated selectors properly
// e.g., ".main, #content" becomes ".main a[href], #content a[href]"
function buildScopedSelector(baseSelector: string, targetSelector: string): string {
  return baseSelector
    .split(",")
    .map((s) => `${s.trim()} ${targetSelector}`)
    .join(", ");
}

// Extract links from page (optionally scoped to a CSS selector)
async function extractLinksFromPage(page: Page, cssSelector?: string): Promise<string[]> {
  const selector = cssSelector ? buildScopedSelector(cssSelector, "a[href]") : "a[href]";
  return page.$$eval(selector, (anchors) => {
    return anchors.map((a) => (a as HTMLAnchorElement).href);
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startUrl = searchParams.get("startUrl");
  const sitemapUrl = searchParams.get("sitemapUrl");
  const cssSelector = searchParams.get("cssSelector") || undefined;

  if (!startUrl) {
    return new Response("Missing startUrl parameter", { status: 400 });
  }

  const { stream, sendEvent, close } = createSSEResponse();
  const hasSitemap = !!sitemapUrl;

  // Start discovery in the background
  (async () => {
    let browser;

  try {
    const origin = new URL(startUrl).origin;
    const discoveredLinks = new Set<string>();
    const visited = new Set<string>();
      let sitemapLinksCount = 0;

      sendEvent({
        type: "status",
        phase: "starting",
        message: hasSitemap 
          ? "📄 Starting sitemap-based discovery..." 
          : "🔍 Starting page crawl discovery...",
        total: 0,
        fromSitemap: 0,
        pagesScanned: 0,
      });

    // Add start URL
    discoveredLinks.add(cleanUrl(startUrl));

      // MODE 1: Sitemap provided - only use sitemap links, no page scanning
      if (hasSitemap) {
        sendEvent({
          type: "status",
          phase: "sitemap",
          message: `📄 Fetching sitemap: ${sitemapUrl}`,
          total: discoveredLinks.size,
          fromSitemap: 0,
          pagesScanned: 0,
        });

        try {
          const xml = await fetchXml(sitemapUrl);
          
          if (isSitemapIndex(xml)) {
            const childSitemapUrls = extractSitemapUrls(xml);
            sendEvent({
              type: "status",
              phase: "sitemap",
              message: `📑 Found sitemap index with ${childSitemapUrls.length} child sitemaps`,
              total: discoveredLinks.size,
              fromSitemap: 0,
              pagesScanned: 0,
            });

            // Fetch all child sitemaps
            const PARALLEL_LIMIT = 5;
            for (let i = 0; i < childSitemapUrls.length; i += PARALLEL_LIMIT) {
              const batch = childSitemapUrls.slice(i, i + PARALLEL_LIMIT);
              const results = await Promise.all(
                batch.map(async (url) => {
                  try {
                    const childXml = await fetchXml(url);
                    return parseSitemapUrls(childXml);
                  } catch {
                    return [];
                  }
                })
              );
              
              for (const urls of results) {
                for (const url of urls) {
          if (url.startsWith(origin) && !isNonHtmlResource(url)) {
            discoveredLinks.add(cleanUrl(url));
                    sitemapLinksCount++;
          }
        }
              }

              sendEvent({
                type: "status",
                phase: "sitemap",
                message: `📄 Processing sitemaps... (${i + batch.length}/${childSitemapUrls.length}) - ${sitemapLinksCount} links found`,
                total: discoveredLinks.size,
                fromSitemap: sitemapLinksCount,
                pagesScanned: 0,
              });
            }
          } else {
            // Regular sitemap
            sendEvent({
              type: "status",
              phase: "sitemap",
              message: `📄 Parsing sitemap...`,
              total: discoveredLinks.size,
              fromSitemap: 0,
              pagesScanned: 0,
            });

            const urls = parseSitemapUrls(xml);
            for (const url of urls) {
              if (url.startsWith(origin) && !isNonHtmlResource(url)) {
                discoveredLinks.add(cleanUrl(url));
                sitemapLinksCount++;
              }
            }
          }

          sendEvent({
            type: "status",
            phase: "sitemap_done",
            message: `✅ Sitemap parsed: ${sitemapLinksCount} links found`,
            total: discoveredLinks.size,
            fromSitemap: sitemapLinksCount,
            pagesScanned: 0,
          });

          // Sort links by path depth first, then alphabetically
          const sortedLinks = [...discoveredLinks].sort((a, b) => {
            try {
              const pathA = new URL(a).pathname;
              const pathB = new URL(b).pathname;
              const depthA = pathA.split('/').filter(Boolean).length;
              const depthB = pathB.split('/').filter(Boolean).length;
              if (depthA !== depthB) return depthA - depthB;
              return pathA.localeCompare(pathB);
            } catch {
              return a.localeCompare(b);
            }
          });

          // Done - no page scanning when sitemap is provided
          sendEvent({
            type: "done",
            message: `🎉 Discovery complete! Found ${sitemapLinksCount} links from sitemap.`,
            links: sortedLinks,
            total: sortedLinks.length,
            fromSitemap: sitemapLinksCount,
            fromPages: 0,
            pagesScanned: 0,
          });

        } catch (err) {
          sendEvent({
            type: "error",
            message: `Failed to parse sitemap: ${err instanceof Error ? err.message : "Unknown error"}`,
          });
        }
      } else {
        // MODE 2: No sitemap - crawl pages to discover links (NO LIMIT)
        sendEvent({
          type: "status",
          phase: "browser",
          message: "🌐 Launching browser for page discovery...",
          total: discoveredLinks.size,
          fromSitemap: 0,
          pagesScanned: 0,
        });

        browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    const page = await context.newPage();

        // Visit pages to discover links - NO LIMIT when no sitemap
    const pagesToVisit = [startUrl];
    let pagesVisited = 0;
        let newLinksFromPages = 0;

        // Safety limit to prevent infinite crawling on huge sites
        const MAX_PAGES_SAFETY = 5000;

        while (pagesToVisit.length > 0 && pagesVisited < MAX_PAGES_SAFETY) {
      const url = pagesToVisit.shift()!;
      if (visited.has(url)) continue;
      visited.add(url);
      pagesVisited++;

          const previousSize = discoveredLinks.size;

          // Update every page or every 10 pages for performance
          if (pagesVisited % 5 === 1 || pagesVisited === 1) {
            sendEvent({
              type: "status",
              phase: "scanning",
              message: `🔍 Scanning page ${pagesVisited}: ${new URL(url).pathname}`,
              total: discoveredLinks.size,
              fromSitemap: 0,
              pagesScanned: pagesVisited,
              currentUrl: url,
            });
          }

      try {
        await page.goto(url, {
          waitUntil: "domcontentloaded",
              timeout: 15000,
        });

        const links = await extractLinksFromPage(page, cssSelector);

        for (const link of links) {
          const cleanedLink = cleanUrl(link);
          if (
            cleanedLink.startsWith(origin) &&
            !isNonHtmlResource(cleanedLink) &&
            !discoveredLinks.has(cleanedLink)
          ) {
            discoveredLinks.add(cleanedLink);
                newLinksFromPages++;
                // Add to visit queue for further discovery
                if (!visited.has(cleanedLink)) {
              pagesToVisit.push(cleanedLink);
            }
          }
        }

            const newLinksFound = discoveredLinks.size - previousSize;
            if (newLinksFound > 0) {
              sendEvent({
                type: "status",
                phase: "scanning",
                message: `✨ Found ${newLinksFound} new links on ${new URL(url).pathname} (${discoveredLinks.size} total)`,
                total: discoveredLinks.size,
                fromSitemap: 0,
                pagesScanned: pagesVisited,
              });
            }
      } catch {
        // Page failed to load, skip
      }

          // Check if queue is empty (we've discovered all reachable pages)
          if (pagesToVisit.length === 0) {
            sendEvent({
              type: "status",
              phase: "scanning",
              message: `📋 All reachable pages scanned (${pagesVisited} pages)`,
              total: discoveredLinks.size,
              fromSitemap: 0,
              pagesScanned: pagesVisited,
            });
          }
    }

    await browser.close();
        browser = undefined;

        // Sort links by path depth first, then alphabetically
    const sortedLinks = [...discoveredLinks].sort((a, b) => {
      try {
        const pathA = new URL(a).pathname;
        const pathB = new URL(b).pathname;
            const depthA = pathA.split('/').filter(Boolean).length;
            const depthB = pathB.split('/').filter(Boolean).length;
            if (depthA !== depthB) return depthA - depthB;
        return pathA.localeCompare(pathB);
      } catch {
        return a.localeCompare(b);
      }
    });

        sendEvent({
          type: "done",
          message: `🎉 Discovery complete! Scanned ${pagesVisited} pages, found ${sortedLinks.length} links.`,
      links: sortedLinks,
      total: sortedLinks.length,
          fromSitemap: 0,
          fromPages: newLinksFromPages,
          pagesScanned: pagesVisited,
    });
      }
    } catch (err) {
      sendEvent({
        type: "error",
        message: err instanceof Error ? err.message : "Discovery failed",
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
