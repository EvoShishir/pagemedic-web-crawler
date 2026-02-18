import { useState } from "react";
import { StatsGrid } from "./StatsGrid";
import { CrawlButtons } from "./CrawlButtons";
import { CrawlerStats } from "../hooks/useStats";

interface ConfigCardProps {
  isDark: boolean;
  onToggleTheme?: () => void;
  stats: CrawlerStats;
  isCrawling: boolean;
  isDiscovering: boolean;
  onStartCrawl: (
    startUrl: string,
    sitemapUrl: string,
    concurrency: number
  ) => void;
  onStop: () => void;
}

export function ConfigCard({
  isDark,
  stats,
  isCrawling,
  isDiscovering,
  onStartCrawl,
  onStop,
}: ConfigCardProps) {
  const [startUrl, setStartUrl] = useState("");
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [concurrency, setConcurrency] = useState(3);

  const isDisabled = isCrawling || isDiscovering;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDisabled) {
      onStartCrawl(startUrl, sitemapUrl, concurrency);
    }
  };

  return (
    <section
      className={`h-[calc(100vh-100px)] overflow-auto md:col-span-1 rounded-2xl p-6 border transition-colors ${
        isDark
          ? "bg-zinc-800/80 border-zinc-600/80 glow-primary-subtle"
          : "bg-white/80 border-slate-200 glow-primary-subtle-light"
      }`}
    >
      <div className="mb-4">
        <StatsGrid stats={stats} isDark={isDark} />
      </div>

      <form onSubmit={handleSubmit}>

        <div className="space-y-4">
          <div className="space-y-2">
            <label
              className={`block text-sm font-medium ${
                isDark ? "text-zinc-400" : "text-slate-600"
              }`}
            >
              Start URL
              <span className="text-indigo-500 ml-1">*</span>
            </label>
            <input
              type="url"
              value={startUrl}
              onChange={(e) => {
                setStartUrl(e.target.value);
                setSitemapUrl(
                  e.target.value.endsWith("/")
                    ? e.target.value + "sitemap.xml"
                    : e.target.value + "/sitemap.xml"
                );
              }}
              placeholder="https://www.google.com"
              disabled={isDisabled}
              className={`w-full px-4 py-3 rounded-xl border input-focus-ring transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
                  ? "bg-zinc-900 border-zinc-600/80 text-white placeholder-zinc-500"
                  : "bg-white border-slate-200 text-slate-900 placeholder-slate-400"
              }`}
            />
          </div>

          <div className="space-y-2">
            <label
              className={`block text-sm font-medium ${
                isDark ? "text-zinc-400" : "text-slate-600"
              }`}
            >
              Sitemap URL
              <span
                className={`ml-1 text-xs ${
                  isDark ? "text-zinc-500" : "text-slate-400"
                }`}
              >
                (optional)
              </span>
            </label>
            <input
              type="url"
              value={sitemapUrl}
              onChange={(e) => setSitemapUrl(e.target.value)}
              placeholder="https://example.com/sitemap.xml"
              disabled={isDisabled}
              className={`w-full px-4 py-3 rounded-xl border input-focus-ring transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
                  ? "bg-zinc-900 border-zinc-600/80 text-white placeholder-zinc-500"
                  : "bg-white border-slate-200 text-slate-900 placeholder-slate-400"
              }`}
            />
          </div>

          <div className="space-y-2">
            <label
              className={`block text-sm font-medium ${
                isDark ? "text-zinc-400" : "text-slate-600"
              }`}
            >
              Parallel Workers
              <span
                className={`ml-2 font-mono text-xs px-1.5 py-0.5 rounded ${
                  isDark
                    ? "bg-indigo-500/20 text-indigo-400"
                    : "bg-indigo-100 text-indigo-600"
                }`}
              >
                {concurrency}
              </span>
            </label>
            <input
              type="range"
              min={1}
              max={20}
              value={concurrency}
              onChange={(e) => setConcurrency(parseInt(e.target.value))}
              disabled={isDisabled}
              className="w-full accent-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div
              className={`flex justify-between text-xs ${
                isDark ? "text-zinc-500" : "text-slate-400"
              }`}
            >
              <span>1 (low resource usage)</span>
              <span>10 (balanced)</span>
              <span>20 (high resource usage)</span>
            </div>
          </div>
        </div>

        <CrawlButtons
          isCrawling={isCrawling}
          isDiscovering={isDiscovering}
          startUrl={startUrl}
          onStop={onStop}
          isDark={isDark}
        />
      </form>

      {/* <StatsGrid stats={stats} isDark={isDark} /> */}
    </section>
  );
}
