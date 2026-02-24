import { NON_HTML_EXTENSIONS, SKIP_EXTERNAL_DOMAINS } from "./constants";

export function cleanUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

export function isNonHtmlResource(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return NON_HTML_EXTENSIONS.some((ext) => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

// Returns true if URL is purely a hash anchor (e.g. "#section") or has no path
export function isHashOnlyOrAnchor(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hash !== "" && (parsed.pathname === "/" || parsed.pathname === "");
  } catch {
    return url.startsWith("#");
  }
}

export function shouldSkipExternalCheck(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return SKIP_EXTERNAL_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

export function sortByPathDepth(urls: string[]): string[] {
  return [...urls].sort((a, b) => {
    try {
      const pathA = new URL(a).pathname;
      const pathB = new URL(b).pathname;
      const depthA = pathA.split("/").filter(Boolean).length;
      const depthB = pathB.split("/").filter(Boolean).length;
      if (depthA !== depthB) return depthA - depthB;
      return pathA.localeCompare(pathB);
    } catch {
      return a.localeCompare(b);
    }
  });
}
