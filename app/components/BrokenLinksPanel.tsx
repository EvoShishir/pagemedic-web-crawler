import { useState, useMemo } from "react";
import { BrokenLink } from "../types/crawler";

interface BrokenLinksPanelProps {
  brokenLinks: BrokenLink[];
  isDark: boolean;
}

type StatusFilter = "all" | "404" | "401" | "403" | "5xx" | "other";

// Helper to safely extract pathname or return the original string
function getDisplayPath(urlString: string): string {
  try {
    if (urlString.startsWith("[") || !urlString.startsWith("http")) {
      return urlString;
    }
    const url = new URL(urlString);
    return url.pathname || urlString;
  } catch {
    return urlString;
  }
}

// Get status code category
function getStatusCategory(statusCode: number): StatusFilter {
  if (statusCode === 404) return "404";
  if (statusCode === 401) return "401";
  if (statusCode === 403) return "403";
  if (statusCode >= 500 && statusCode < 600) return "5xx";
  return "other";
}

// Get color scheme for status code
function getStatusColors(statusCode: number, isDark: boolean) {
  if (statusCode === 404) {
    return {
      bg: isDark ? "bg-red-500/20" : "bg-red-100",
      text: isDark ? "text-red-400" : "text-red-600",
      border: isDark ? "hover:border-red-500/30" : "hover:border-red-300",
    };
  }
  if (statusCode === 401 || statusCode === 403) {
    return {
      bg: isDark ? "bg-amber-500/20" : "bg-amber-100",
      text: isDark ? "text-amber-400" : "text-amber-600",
      border: isDark ? "hover:border-amber-500/30" : "hover:border-amber-300",
    };
  }
  if (statusCode >= 500) {
    return {
      bg: isDark ? "bg-purple-500/20" : "bg-purple-100",
      text: isDark ? "text-purple-400" : "text-purple-600",
      border: isDark ? "hover:border-purple-500/30" : "hover:border-purple-300",
    };
  }
  return {
    bg: isDark ? "bg-zinc-600/50" : "bg-slate-200",
    text: isDark ? "text-zinc-400" : "text-slate-600",
    border: isDark ? "hover:border-zinc-500/30" : "hover:border-slate-300",
  };
}

// Get label for status code
function getStatusLabel(statusCode: number): string {
  switch (statusCode) {
    case 400: return "Bad Request";
    case 401: return "Unauthorized";
    case 403: return "Forbidden";
    case 404: return "Not Found";
    case 405: return "Method Not Allowed";
    case 408: return "Timeout";
    case 410: return "Gone";
    case 429: return "Too Many Requests";
    case 500: return "Server Error";
    case 502: return "Bad Gateway";
    case 503: return "Service Unavailable";
    case 504: return "Gateway Timeout";
    default: return statusCode >= 500 ? "Server Error" : "Error";
  }
}

export function BrokenLinksPanel({ brokenLinks, isDark }: BrokenLinksPanelProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all");

  // Calculate counts for each category
  const categoryCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: brokenLinks.length,
      "404": 0,
      "401": 0,
      "403": 0,
      "5xx": 0,
      other: 0,
    };

    brokenLinks.forEach((link) => {
      const category = getStatusCategory(link.statusCode);
      counts[category]++;
    });

    return counts;
  }, [brokenLinks]);

  // Filter links based on active filter
  const filteredLinks = useMemo(() => {
    if (activeFilter === "all") return brokenLinks;
    return brokenLinks.filter((link) => getStatusCategory(link.statusCode) === activeFilter);
  }, [brokenLinks, activeFilter]);

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Filter tabs configuration
  const filterTabs: { id: StatusFilter; label: string; description: string; icon: React.ReactNode }[] = [
    {
      id: "all",
      label: "All",
      description: "All HTTP errors",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      ),
    },
    {
      id: "404",
      label: "404",
      description: "Truly broken links",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      ),
    },
    {
      id: "401",
      label: "401",
      description: "Needs authentication",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
    },
    {
      id: "403",
      label: "403",
      description: "Access denied",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      ),
    },
    {
      id: "5xx",
      label: "5xx",
      description: "Server errors",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    {
      id: "other",
      label: "Other",
      description: "Other HTTP errors",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  if (brokenLinks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16">
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
            isDark ? "bg-emerald-500/10" : "bg-emerald-100"
          }`}
        >
          <svg
            className={`w-8 h-8 ${isDark ? "text-emerald-400" : "text-emerald-600"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3
          className={`text-lg font-medium mb-1 ${
            isDark ? "text-zinc-200" : "text-slate-700"
          }`}
        >
          No HTTP Errors Found
        </h3>
        <p
          className={`text-sm ${isDark ? "text-zinc-500" : "text-slate-500"}`}
        >
          All links are returning valid responses
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tabs for status code filtering */}
      <div
        className={`px-4 py-3 border-b ${
          isDark ? "border-zinc-700/50 bg-zinc-800/50" : "border-slate-200 bg-slate-50/50"
        }`}
      >
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {filterTabs.map((tab) => {
            const count = categoryCounts[tab.id];
            if (tab.id !== "all" && count === 0) return null;

            const isActive = activeFilter === tab.id;
            const getTabColors = () => {
              if (!isActive) {
                return isDark
                  ? "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-100";
              }
              switch (tab.id) {
                case "404":
                  return isDark
                    ? "bg-red-500/20 text-red-400 border-red-500/40"
                    : "bg-red-50 text-red-600 border-red-300";
                case "401":
                case "403":
                  return isDark
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                    : "bg-amber-50 text-amber-600 border-amber-300";
                case "5xx":
                  return isDark
                    ? "bg-purple-500/20 text-purple-400 border-purple-500/40"
                    : "bg-purple-50 text-purple-600 border-purple-300";
                default:
                  return isDark
                    ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/40"
                    : "bg-indigo-50 text-indigo-600 border-indigo-300";
              }
            };

            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                title={tab.description}
                className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap border ${
                  isActive ? "border" : "border-transparent"
                } ${getTabColors()}`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {count > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      isActive
                        ? isDark
                          ? "bg-white/10"
                          : "bg-black/10"
                        : isDark
                        ? "bg-zinc-700"
                        : "bg-slate-200"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Category description banner */}
        {activeFilter !== "all" && (
          <div
            className={`mt-3 flex items-start gap-2 p-3 rounded-lg text-xs ${
              activeFilter === "404"
                ? isDark
                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                  : "bg-red-50 text-red-700 border border-red-200"
                : activeFilter === "401"
                ? isDark
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
                : activeFilter === "403"
                ? isDark
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
                : activeFilter === "5xx"
                ? isDark
                  ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                  : "bg-purple-50 text-purple-700 border border-purple-200"
                : isDark
                ? "bg-zinc-700/50 text-zinc-400 border border-zinc-600"
                : "bg-slate-100 text-slate-600 border border-slate-200"
            }`}
          >
            <svg
              className="w-4 h-4 shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <span className="font-semibold">
                {activeFilter === "404" && "404 Not Found — "}
                {activeFilter === "401" && "401 Unauthorized — "}
                {activeFilter === "403" && "403 Forbidden — "}
                {activeFilter === "5xx" && "5xx Server Errors — "}
                {activeFilter === "other" && "Other HTTP Errors — "}
              </span>
              {activeFilter === "404" && "These pages don't exist. The links pointing to them need to be fixed or removed."}
              {activeFilter === "401" && "These pages require authentication. Not necessarily broken, but may need login to access."}
              {activeFilter === "403" && "Access to these pages is denied. Could be intentional (admin areas) or misconfigured permissions."}
              {activeFilter === "5xx" && "Server-side errors. Usually temporary issues — retry later or check server logs."}
              {activeFilter === "other" && "Various HTTP client errors (400, 405, 429, etc.)."}
            </div>
          </div>
        )}
      </div>

      {/* Links list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredLinks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
                isDark ? "bg-zinc-700/50" : "bg-slate-100"
              }`}
            >
              <svg
                className={`w-6 h-6 ${isDark ? "text-zinc-500" : "text-slate-400"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <p className={`text-sm ${isDark ? "text-zinc-500" : "text-slate-500"}`}>
              No links with this status code
            </p>
          </div>
        ) : (
          filteredLinks.map((link, index) => {
            const colors = getStatusColors(link.statusCode, isDark);
            return (
        <div
          key={index}
          className={`rounded-xl border overflow-hidden transition-all ${
            isDark
                    ? `bg-zinc-800/60 border-zinc-700 ${colors.border}`
                    : `bg-white border-slate-200 ${colors.border}`
          }`}
        >
          {/* Header - Always visible */}
          <div
            className={`px-4 py-3 cursor-pointer ${
              isDark ? "hover:bg-zinc-700/30" : "hover:bg-slate-50"
            }`}
            onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
          >
            <div className="flex items-start gap-3">
              <div
                      className={`shrink-0 w-10 h-10 rounded-lg flex flex-col items-center justify-center font-bold text-xs ${colors.bg} ${colors.text}`}
              >
                      <span className="text-sm">{link.statusCode || "ERR"}</span>
              </div>
              <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                <div
                  className={`font-medium text-sm truncate ${
                    isDark ? "text-zinc-100" : "text-slate-800"
                  }`}
                >
                  {link.url}
                        </div>
                        <span
                          className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${colors.bg} ${colors.text}`}
                        >
                          {getStatusLabel(link.statusCode)}
                        </span>
                </div>
                {/* Source page - highlighted */}
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      isDark ? "bg-indigo-500/20 text-indigo-400" : "bg-indigo-100 text-indigo-600"
                    }`}
                  >
                    📍 Source
                  </span>
                  <span
                    className={`text-xs truncate ${
                      isDark ? "text-indigo-400" : "text-indigo-600"
                    }`}
                  >
                    {getDisplayPath(link.foundOnPage)}
                  </span>
                </div>
                {/* Link text preview */}
                {link.linkText && link.linkText !== "[Unknown]" && link.linkText !== "[Detected from network]" && (
                  <div
                    className={`text-xs mt-1 truncate ${
                      isDark ? "text-zinc-500" : "text-slate-500"
                    }`}
                  >
                    Link text: &quot;{link.linkText}&quot;
                  </div>
                )}
              </div>
              <svg
                className={`w-5 h-5 shrink-0 transition-transform ${
                  expandedIndex === index ? "rotate-180" : ""
                } ${isDark ? "text-zinc-500" : "text-slate-400"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>

          {/* Expanded Details */}
          {expandedIndex === index && (
            <div
              className={`px-4 py-3 border-t space-y-3 ${
                isDark ? "border-zinc-700 bg-zinc-900/50" : "border-slate-100 bg-slate-50"
              }`}
            >
              <div className="grid gap-3">
                <div>
                  <div
                    className={`text-xs uppercase tracking-wider mb-1 ${
                      isDark ? "text-zinc-500" : "text-slate-500"
                    }`}
                  >
                          Target URL
                  </div>
                  <div className="flex items-center gap-2">
                    <code
                      className={`flex-1 text-xs px-3 py-2 rounded-lg break-all ${
                              isDark ? `bg-zinc-800 ${colors.text}` : `bg-white ${colors.text}`
                      }`}
                    >
                      {link.url}
                    </code>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(link.url, index);
                      }}
                      className={`cursor-pointer shrink-0 p-2 rounded-lg transition-colors ${
                        isDark
                          ? "hover:bg-zinc-700 text-zinc-400"
                          : "hover:bg-slate-200 text-slate-500"
                      }`}
                      title="Copy URL"
                    >
                      {copiedIndex === index ? (
                        <svg
                          className="w-4 h-4 text-emerald-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <div
                    className={`text-xs uppercase tracking-wider mb-1 flex items-center gap-2 ${
                      isDark ? "text-zinc-500" : "text-slate-500"
                    }`}
                  >
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        isDark ? "bg-indigo-500/30 text-indigo-400" : "bg-indigo-100 text-indigo-600"
                      }`}
                    >
                      FIX HERE
                    </span>
                          Page Containing This Link
                  </div>
                  {link.foundOnPage.startsWith("http") ? (
                    <a
                      href={link.foundOnPage}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className={`text-xs px-3 py-2 rounded-lg block break-all transition-colors font-medium ${
                        isDark
                          ? "bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 border border-indigo-500/30"
                          : "bg-indigo-50 text-indigo-600 hover:text-indigo-500 border border-indigo-200"
                      }`}
                    >
                      {link.foundOnPage}
                    </a>
                  ) : (
                    <div
                      className={`text-xs px-3 py-2 rounded-lg break-all ${
                        isDark ? "bg-zinc-800 text-zinc-400" : "bg-white text-slate-600"
                      }`}
                    >
                      {link.foundOnPage}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div
                      className={`text-xs uppercase tracking-wider mb-1 ${
                        isDark ? "text-zinc-500" : "text-slate-500"
                      }`}
                    >
                      Link Text
                    </div>
                    <div
                      className={`text-sm px-3 py-2 rounded-lg ${
                        isDark ? "bg-zinc-800 text-zinc-300" : "bg-white text-slate-700"
                      }`}
                    >
                      {link.linkText || "[No text]"}
                    </div>
                  </div>
                  <div>
                    <div
                      className={`text-xs uppercase tracking-wider mb-1 ${
                        isDark ? "text-zinc-500" : "text-slate-500"
                      }`}
                    >
                      Element Location
                    </div>
                    <div
                      className={`text-sm px-3 py-2 rounded-lg font-mono ${
                        isDark ? "bg-zinc-800 text-amber-400" : "bg-white text-amber-600"
                      }`}
                    >
                      {link.elementContext}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
            );
          })
        )}
      </div>
    </div>
  );
}
