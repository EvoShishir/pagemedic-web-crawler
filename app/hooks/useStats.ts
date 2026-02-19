import { useMemo } from "react";
import { BrokenLink, BrokenImage, ConsoleError } from "../types/crawler";

export interface CrawlerStats {
  crawled: number;
  errors: number;
  linksChecked: number;
  brokenLinks: number;
  brokenImages: number;
  consoleErrors: number;
}

export function useStats(
  logs: string[],
  brokenLinks: BrokenLink[],
  brokenImages: BrokenImage[],
  consoleErrors: ConsoleError[],
  linksChecked: number
): CrawlerStats {
  return useMemo(() => {
    let crawled = 0;
    let errors = 0;

    logs.forEach((log) => {
      if (log.includes("🔍 Crawling")) crawled++;
      if (log.includes("❌") || log.includes("🚫")) errors++;
    });

    return {
      crawled,
      errors,
      linksChecked,
      brokenLinks: brokenLinks.length,
      brokenImages: brokenImages.length,
      consoleErrors: consoleErrors.length,
    };
  }, [logs, brokenLinks, brokenImages, consoleErrors, linksChecked]);
}
