import { chromium, Page } from "playwright";
import { NextRequest } from "next/server";
import { createSSEResponse, sseHeaders } from "../../../lib/crawler/sse";
import { cleanUrl, isNonHtmlResource, sortByPathDepth } from "../../../lib/crawler/url-utils";
import { fetchXml } from "../../../lib/crawler/http";
import { isSitemapIndex, extractSitemapUrls, parseSitemapUrls } from "../../../lib/crawler/sitemap";
import { extractLinksFromPage } from "../../../lib/crawler/extractors";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startUrl = searchParams.get("startUrl");
  const sitemapUrl = searchParams.get("sitemapUrl");
  const cssSelector = searchParams.get("cssSelector") || undefined;
  const concurrency = Math.min(Math.max(parseInt(searchParams.get("concurrency") || "3") || 3, 1), 20);

  if (!startUrl) {
    return new Response("Missing startUrl parameter", { status: 400 });
  }

  const { stream, sendEvent, close } = createSSEResponse();
  const hasSitemap = !!sitemapUrl;

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

      discoveredLinks.add(cleanUrl(startUrl));

      // MODE 1: Sitemap provided — only use sitemap links, no page scanning
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
          const xml = await fetchXml(sitemapUrl!);

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

            const PARALLEL_LIMIT = 5;
            for (let i = 0; i < childSitemapUrls.length; i += PARALLEL_LIMIT) {
              const batch = childSitemapUrls.slice(i, i + PARALLEL_LIMIT);
              const results = await Promise.all(
                batch.map(async (url) => {
                  try {
                    return parseSitemapUrls(await fetchXml(url));
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
            sendEvent({
              type: "status",
              phase: "sitemap",
              message: `📄 Parsing sitemap...`,
              total: discoveredLinks.size,
              fromSitemap: 0,
              pagesScanned: 0,
            });

            for (const url of parseSitemapUrls(xml)) {
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

          const sortedLinks = sortByPathDepth([...discoveredLinks]);

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
        // MODE 2: No sitemap — crawl pages to discover links with parallel workers
        sendEvent({
          type: "status",
          phase: "browser",
          message: `🌐 Launching browser for page discovery... (${concurrency} worker${concurrency > 1 ? "s" : ""})`,
          total: discoveredLinks.size,
          fromSitemap: 0,
          pagesScanned: 0,
        });

        browser = await chromium.launch({ headless: true, args: ["--disable-http2"] });
        const browserContext = await browser.newContext({
          ignoreHTTPSErrors: true,
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        });

        const pages: Page[] = [];
        for (let i = 0; i < concurrency; i++) {
          pages.push(await browserContext.newPage());
        }

        const queue: string[] = [startUrl];
        let pagesVisited = 0;
        let newLinksFromPages = 0;
        const MAX_PAGES_SAFETY = 5000;

        async function processPage(workerPage: Page, url: string) {
          const previousSize = discoveredLinks.size;
          try {
            await workerPage.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
            const links = await extractLinksFromPage(workerPage, cssSelector);

            for (const link of links) {
              const cleaned = cleanUrl(link);
              if (
                cleaned.startsWith(origin) &&
                !isNonHtmlResource(cleaned) &&
                !discoveredLinks.has(cleaned)
              ) {
                discoveredLinks.add(cleaned);
                newLinksFromPages++;
                if (!visited.has(cleaned)) queue.push(cleaned);
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
        }

        let activeWorkers = 0;

        async function worker(workerPage: Page) {
          while (true) {
            if (pagesVisited >= MAX_PAGES_SAFETY) break;
            const url = queue.shift();
            if (!url) {
              if (activeWorkers === 0) break;
              await new Promise((r) => setTimeout(r, 150));
              continue;
            }
            if (visited.has(url)) continue;
            visited.add(url);
            activeWorkers++;
            pagesVisited++;

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

            await processPage(workerPage, url);
            activeWorkers--;
          }
        }

        await Promise.all(pages.map((p) => worker(p)));

        sendEvent({
          type: "status",
          phase: "scanning",
          message: `📋 All reachable pages scanned (${pagesVisited} pages)`,
          total: discoveredLinks.size,
          fromSitemap: 0,
          pagesScanned: pagesVisited,
        });

        await browser.close();
        browser = undefined;

        const sortedLinks = sortByPathDepth([...discoveredLinks]);

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
      if (browser) await browser.close();
    } finally {
      close();
    }
  })();

  return new Response(stream, { headers: sseHeaders() });
}
