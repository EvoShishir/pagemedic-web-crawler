import { StatsCard } from "./StatsCard";
import { CrawlerStats } from "../hooks/useStats";

interface StatsGridProps {
  stats: CrawlerStats;
  isDark: boolean;
}

export function StatsGrid({ stats, isDark }: StatsGridProps) {
  return (
    <div className="flex flex-col md:grid md:grid-cols-2 gap-4">
      <StatsCard
        value={stats.crawled}
        label="Pages Crawled"
        icon={
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        }
        isDark={isDark}
        iconBgColor={isDark ? "bg-indigo-500/30" : "bg-indigo-100"}
        iconTextColor={isDark ? "text-indigo-400" : "text-indigo-600"}
      />

      <StatsCard
        value={stats.linksChecked}
        label="Links Checked"
        icon={
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        }
        isDark={isDark}
        iconBgColor={isDark ? "bg-teal-500/30" : "bg-teal-100"}
        iconTextColor={isDark ? "text-teal-400" : "text-teal-600"}
      />

      <StatsCard
        value={stats.brokenLinks}
        label="Broken Links"
        icon={
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        }
        isDark={isDark}
        iconBgColor={isDark ? "bg-red-500/30" : "bg-red-100"}
        iconTextColor={isDark ? "text-red-400" : "text-red-600"}
      />

      <StatsCard
        value={stats.brokenImages}
        label="Broken Images"
        icon={
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        }
        isDark={isDark}
        iconBgColor={isDark ? "bg-orange-500/30" : "bg-orange-100"}
        iconTextColor={isDark ? "text-orange-400" : "text-orange-600"}
      />

      <StatsCard
        value={stats.errors}
        label="Errors"
        icon={
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        }
        isDark={isDark}
        iconBgColor={isDark ? "bg-rose-500/30" : "bg-rose-100"}
        iconTextColor={isDark ? "text-rose-400" : "text-rose-600"}
      />

      <StatsCard
        value={stats.consoleErrors}
        label="Console Errors"
        icon={
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        }
        isDark={isDark}
        iconBgColor={isDark ? "bg-violet-500/30" : "bg-violet-100"}
        iconTextColor={isDark ? "text-violet-400" : "text-violet-600"}
      />
    </div>
  );
}
