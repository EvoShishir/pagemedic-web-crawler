import { useState } from "react";
import { Header } from "./Header";
import { StatsGrid } from "./StatsGrid";
import { CrawlButtons } from "./CrawlButtons";
import { CrawlerStats } from "../hooks/useStats";

interface ConfigCardProps {
  isDark: boolean;
  onToggleTheme: () => void;
  stats: CrawlerStats;
  isCrawling: boolean;
  onStartCrawl: (startUrl: string, sitemapUrl: string, cssSelector: string) => void;
  onStop: () => void;
}

export function ConfigCard({
  isDark,
  onToggleTheme,
  stats,
  isCrawling,
  onStartCrawl,
  onStop,
}: ConfigCardProps) {
  const [startUrl, setStartUrl] = useState("");
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [cssSelector, setCssSelector] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCrawling) {
    onStartCrawl(startUrl, sitemapUrl, cssSelector);
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
        {/* <Header isDark={isDark} onToggleTheme={onToggleTheme} /> */}

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
              onChange={(e) => {setStartUrl(e.target.value)
                setSitemapUrl(e.target.value.endsWith("/") ? e.target.value + "sitemap.xml" : e.target.value + "/sitemap.xml")
              }}
              placeholder="https://www.google.com"
              disabled={isCrawling}
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
              disabled={isCrawling}
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
              CSS Selector
              <span
                className={`ml-1 text-xs ${
                  isDark ? "text-zinc-500" : "text-slate-400"
                }`}
              >
                (optional)
              </span>
            </label>
            <input
              type="text"
              value={cssSelector}
              onChange={(e) => setCssSelector(e.target.value)}
              placeholder=".main-content, #article-body"
              disabled={isCrawling}
              className={`w-full px-4 py-3 rounded-xl border input-focus-ring transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm ${
                isDark
                  ? "bg-zinc-900 border-zinc-600/80 text-white placeholder-zinc-500"
                  : "bg-white border-slate-200 text-slate-900 placeholder-slate-400"
              }`}
            />
            <p
              className={`text-xs ${
                isDark ? "text-zinc-500" : "text-slate-400"
              }`}
            >
              Only check links & images within this selector
            </p>
          </div>
        </div>

        <CrawlButtons
          isCrawling={isCrawling}
          startUrl={startUrl}
          onStop={onStop}
          isDark={isDark}
        />
      </form>

        {/* <StatsGrid stats={stats} isDark={isDark} /> */}
    </section>
  );
}
