import { useState } from "react";
import { BrokenLink } from "../types/crawler";

interface BrokenLinksPanelProps {
  brokenLinks: BrokenLink[];
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

export function BrokenLinksPanel({ brokenLinks, isDark }: BrokenLinksPanelProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

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
          No Broken Links Found
        </h3>
        <p
          className={`text-sm ${isDark ? "text-zinc-500" : "text-slate-500"}`}
        >
          All links are working correctly
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {brokenLinks.map((link, index) => (
        <div
          key={index}
          className={`rounded-xl border overflow-hidden transition-all ${
            isDark
              ? "bg-zinc-800/60 border-zinc-700 hover:border-red-500/30"
              : "bg-white border-slate-200 hover:border-red-300"
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
                className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                  isDark ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-600"
                }`}
              >
                {link.statusCode || "ERR"}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={`font-medium text-sm truncate ${
                    isDark ? "text-zinc-100" : "text-slate-800"
                  }`}
                >
                  {link.url}
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
                    Broken URL
                  </div>
                  <div className="flex items-center gap-2">
                    <code
                      className={`flex-1 text-xs px-3 py-2 rounded-lg break-all ${
                        isDark ? "bg-zinc-800 text-red-400" : "bg-white text-red-600"
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
                    Page Containing The Broken Link
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
      ))}
    </div>
  );
}
