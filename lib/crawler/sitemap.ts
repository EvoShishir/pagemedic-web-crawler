export function isSitemapIndex(xml: string): boolean {
  return xml.includes("<sitemapindex") || xml.includes("<sitemap>");
}

// Extract child sitemap URLs from a sitemap index document
export function extractSitemapUrls(xml: string): string[] {
  const urls: string[] = [];
  const sitemapMatches = xml.match(/<sitemap[^>]*>[\s\S]*?<\/sitemap>/gi) || [];
  for (const match of sitemapMatches) {
    const locMatch = match.match(/<loc>(.*?)<\/loc>/i);
    if (locMatch?.[1]) {
      urls.push(locMatch[1].trim());
    }
  }
  return urls;
}

// Extract page URLs from a standard sitemap XML document
export function parseSitemapUrls(xml: string): string[] {
  const urls = new Set<string>();

  // Prefer <url>…<loc>…</loc>…</url> patterns (canonical)
  const urlMatches = xml.match(/<url[^>]*>[\s\S]*?<\/url>/gi) || [];
  for (const match of urlMatches) {
    const locMatch = match.match(/<loc>(.*?)<\/loc>/i);
    if (locMatch?.[1]) {
      urls.add(locMatch[1].trim());
    }
  }

  // Fallback: bare <loc> extraction for simpler sitemaps
  if (urls.size === 0) {
    const locMatches = xml.match(/<loc>(.*?)<\/loc>/gi) || [];
    for (const match of locMatches) {
      const loc = match.replace(/<\/?loc>/gi, "").trim();
      if (!loc.endsWith(".xml") && !loc.includes("sitemap")) {
        urls.add(loc);
      }
    }
  }

  return [...urls];
}
