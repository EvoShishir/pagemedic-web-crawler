export interface BrokenLink {
  url: string;
  statusCode: number;
  foundOnPage: string;
  linkText: string;
  elementContext: string;
  timestamp: string;
}

export interface BrokenImage {
  src: string;
  foundOnPage: string;
  altText: string;
  elementContext: string;
  reason: string;
  timestamp: string;
}

export interface ConsoleError {
  message: string;
  foundOnPage: string;
  type: "error" | "warning" | "js_error";
  timestamp: string;
}

export interface NavigationIssue {
  url: string;
  reason: string;
  foundOnPage: string;
  linkText: string;
  elementContext: string;
  timestamp: string;
}

export interface CrawlerEventData {
  type: "log" | "prompt" | "done" | "error" | "broken_link" | "broken_image" | "console_error" | "navigation_issue";
  message?: string;
  sessionId?: string;
  data?: BrokenLink | BrokenImage | ConsoleError | NavigationIssue;
}

export interface DiscoveryStatus {
  phase: "starting" | "sitemap" | "sitemap_done" | "sitemap_error" | "sitemap_detect" | "sitemap_not_found" | "browser" | "scanning";
  message: string;
  total: number;
  fromSitemap: number;
  pagesScanned: number;
  currentUrl?: string;
}

export interface DiscoveryEventData {
  type: "status" | "done" | "error";
  phase?: string;
  message: string;
  total?: number;
  fromSitemap?: number;
  fromPages?: number;
  pagesScanned?: number;
  currentUrl?: string;
  links?: string[];
}
