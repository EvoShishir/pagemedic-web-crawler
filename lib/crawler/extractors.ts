import { Page } from "playwright";

// Scope a selector (e.g. ".main, #content") to target child elements
// ".main, #content" + "a[href]" → ".main a[href], #content a[href]"
export function buildScopedSelector(baseSelector: string, targetSelector: string): string {
  return baseSelector
    .split(",")
    .map((s) => `${s.trim()} ${targetSelector}`)
    .join(", ");
}

// Extract plain href strings from a page (used by discover route)
export async function extractLinksFromPage(page: Page, cssSelector?: string): Promise<string[]> {
  const selector = cssSelector ? buildScopedSelector(cssSelector, "a[href]") : "a[href]";
  return page.$$eval(selector, (anchors) =>
    anchors.map((a) => (a as HTMLAnchorElement).href)
  );
}

// Extract links with rich context for the crawl route
export async function extractLinksWithContext(
  page: Page,
  cssSelector?: string
): Promise<Array<{ href: string; text: string; context: string; isInHeader: boolean }>> {
  const selector = cssSelector ? buildScopedSelector(cssSelector, "a[href]") : "a[href]";
  return page.$$eval(selector, (anchors) =>
    anchors.map((a) => {
      const anchor = a as HTMLAnchorElement;
      const parent = anchor.closest("nav, header, footer, article, section, aside, main");
      const parentTag = parent?.tagName.toLowerCase() || "body";
      const parentClass = parent?.className
        ? `.${parent.className.split(" ").filter(Boolean).slice(0, 2).join(".")}`
        : "";
      return {
        href: anchor.href,
        text: anchor.textContent?.trim() || "[No text]",
        context: `<${parentTag}${parentClass}>`,
        isInHeader: anchor.closest("header, nav") !== null,
      };
    })
  );
}

// Extract image metadata from a page
export async function extractImagesWithContext(
  page: Page,
  cssSelector?: string
): Promise<Array<{ src: string; alt: string; context: string; naturalWidth: number; complete: boolean }>> {
  const selector = cssSelector ? buildScopedSelector(cssSelector, "img") : "img";
  return page.$$eval(selector, (images) =>
    images.map((img) => {
      const image = img as HTMLImageElement;
      const parent = image.closest(
        "figure, article, section, header, footer, aside, main, div"
      );
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
    })
  );
}

// Extract URLs from meta tags, <link> elements, and JSON-LD structured data
export async function extractMetaUrls(
  page: Page
): Promise<Array<{ url: string; context: string }>> {
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

    document.querySelectorAll("link[href]").forEach((el) => {
      const link = el as HTMLLinkElement;
      const rel = link.getAttribute("rel") || "unknown";
      addUrl(link.href, `<link rel="${rel}">`);
    });

    document
      .querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]')
      .forEach((el) => {
        const meta = el as HTMLMetaElement;
        const name = meta.getAttribute("property") || meta.getAttribute("name") || "";
        const content = meta.getAttribute("content") || "";
        if (content.startsWith("http")) addUrl(content, `<meta ${name}>`);
      });

    document.querySelectorAll('meta[http-equiv="refresh"]').forEach((el) => {
      const content = el.getAttribute("content") || "";
      const urlMatch = content.match(/url\s*=\s*['"]?(https?:\/\/[^'";\s]+)/i);
      if (urlMatch) addUrl(urlMatch[1], `<meta http-equiv="refresh">`);
    });

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
