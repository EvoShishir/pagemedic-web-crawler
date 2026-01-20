import { useState } from "react";
import { ConsoleError } from "../types/crawler";

interface ConsoleErrorsPanelProps {
  consoleErrors: ConsoleError[];
  isDark: boolean;
}

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

// Get icon and color based on error type
function getErrorTypeStyles(type: ConsoleError["type"], isDark: boolean) {
  switch (type) {
    case "js_error":
      return {
        icon: "🔥",
        label: "JS Error",
        bgColor: isDark ? "bg-orange-500/20" : "bg-orange-100",
        textColor: isDark ? "text-orange-400" : "text-orange-600",
        borderColor: isDark ? "border-orange-500/30" : "border-orange-200",
      };
    case "warning":
      return {
        icon: "⚠️",
        label: "Warning",
        bgColor: isDark ? "bg-amber-500/20" : "bg-amber-100",
        textColor: isDark ? "text-amber-400" : "text-amber-600",
        borderColor: isDark ? "border-amber-500/30" : "border-amber-200",
      };
    case "error":
    default:
      return {
        icon: "❌",
        label: "Error",
        bgColor: isDark ? "bg-red-500/20" : "bg-red-100",
        textColor: isDark ? "text-red-400" : "text-red-600",
        borderColor: isDark ? "border-red-500/30" : "border-red-200",
      };
  }
}

export function ConsoleErrorsPanel({ consoleErrors, isDark }: ConsoleErrorsPanelProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "error" | "js_error" | "warning">("all");

  const filteredErrors = consoleErrors.filter((error) => {
    if (filter === "all") return true;
    return error.type === filter;
  });

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (consoleErrors.length === 0) {
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
          No Console Errors Found
        </h3>
        <p
          className={`text-sm ${isDark ? "text-zinc-500" : "text-slate-500"}`}
        >
          All pages are running without console errors
        </p>
      </div>
    );
  }

  // Count errors by type
  const errorCounts = {
    all: consoleErrors.length,
    error: consoleErrors.filter((e) => e.type === "error").length,
    js_error: consoleErrors.filter((e) => e.type === "js_error").length,
    warning: consoleErrors.filter((e) => e.type === "warning").length,
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filter tabs */}
      <div
        className={`px-4 py-2 border-b flex gap-2 sticky top-0 z-10 ${
          isDark ? "border-zinc-700 bg-zinc-800/95" : "border-slate-200 bg-white/95"
        }`}
      >
        {[
          { key: "all" as const, label: "All", count: errorCounts.all },
          { key: "error" as const, label: "Errors", count: errorCounts.error },
          { key: "js_error" as const, label: "JS Errors", count: errorCounts.js_error },
          { key: "warning" as const, label: "Warnings", count: errorCounts.warning },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`cursor-pointer px-3 py-1.5 text-xs rounded-lg transition-colors ${
              filter === tab.key
                ? isDark
                  ? "bg-violet-500/20 text-violet-400"
                  : "bg-violet-100 text-violet-700"
                : isDark
                ? "text-zinc-400 hover:text-zinc-300 hover:bg-zinc-700"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                  filter === tab.key
                    ? isDark
                      ? "bg-violet-500/30"
                      : "bg-violet-200"
                    : isDark
                    ? "bg-zinc-700"
                    : "bg-slate-200"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Error list */}
      <div className="p-4 space-y-3 flex-1 overflow-auto">
        {filteredErrors.map((error, index) => {
          const styles = getErrorTypeStyles(error.type, isDark);

          return (
            <div
              key={index}
              className={`rounded-xl border overflow-hidden transition-all ${
                isDark
                  ? `bg-zinc-800/60 border-zinc-700 hover:${styles.borderColor}`
                  : `bg-white border-slate-200 hover:${styles.borderColor}`
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
                    className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-lg ${styles.bgColor}`}
                  >
                    {styles.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Error type badge */}
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${styles.bgColor} ${styles.textColor}`}
                      >
                        {styles.label}
                      </span>
                    </div>
                    {/* Error message */}
                    <div
                      className={`font-medium text-sm line-clamp-2 ${
                        isDark ? "text-zinc-100" : "text-slate-800"
                      }`}
                    >
                      {error.message}
                    </div>
                    {/* Source page */}
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          isDark ? "bg-indigo-500/20 text-indigo-400" : "bg-indigo-100 text-indigo-600"
                        }`}
                      >
                        📍 Page
                      </span>
                      <span
                        className={`text-xs truncate ${
                          isDark ? "text-indigo-400" : "text-indigo-600"
                        }`}
                      >
                        {getDisplayPath(error.foundOnPage)}
                      </span>
                    </div>
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
                        Full Error Message
                      </div>
                      <div className="flex items-start gap-2">
                        <code
                          className={`flex-1 text-xs px-3 py-2 rounded-lg break-all whitespace-pre-wrap ${
                            isDark ? `bg-zinc-800 ${styles.textColor}` : `bg-white ${styles.textColor}`
                          }`}
                        >
                          {error.message}
                        </code>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(error.message, index);
                          }}
                          className={`cursor-pointer shrink-0 p-2 rounded-lg transition-colors ${
                            isDark
                              ? "hover:bg-zinc-700 text-zinc-400"
                              : "hover:bg-slate-200 text-slate-500"
                          }`}
                          title="Copy error message"
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
                        className={`text-xs uppercase tracking-wider mb-1 ${
                          isDark ? "text-zinc-500" : "text-slate-500"
                        }`}
                      >
                        Found On Page
                      </div>
                      {error.foundOnPage.startsWith("http") ? (
                        <a
                          href={error.foundOnPage}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className={`text-xs px-3 py-2 rounded-lg block break-all transition-colors font-medium ${
                            isDark
                              ? "bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 border border-indigo-500/30"
                              : "bg-indigo-50 text-indigo-600 hover:text-indigo-500 border border-indigo-200"
                          }`}
                        >
                          {error.foundOnPage}
                        </a>
                      ) : (
                        <div
                          className={`text-xs px-3 py-2 rounded-lg break-all ${
                            isDark ? "bg-zinc-800 text-zinc-400" : "bg-white text-slate-600"
                          }`}
                        >
                          {error.foundOnPage}
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
                          Error Type
                        </div>
                        <div
                          className={`text-sm px-3 py-2 rounded-lg flex items-center gap-2 ${styles.bgColor} ${styles.textColor}`}
                        >
                          <span>{styles.icon}</span>
                          <span>{styles.label}</span>
                        </div>
                      </div>
                      <div>
                        <div
                          className={`text-xs uppercase tracking-wider mb-1 ${
                            isDark ? "text-zinc-500" : "text-slate-500"
                          }`}
                        >
                          Timestamp
                        </div>
                        <div
                          className={`text-sm px-3 py-2 rounded-lg ${
                            isDark ? "bg-zinc-800 text-zinc-300" : "bg-white text-slate-700"
                          }`}
                        >
                          {new Date(error.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
