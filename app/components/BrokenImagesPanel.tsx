import { useState } from "react";
import { BrokenImage } from "../types/crawler";

interface BrokenImagesPanelProps {
  brokenImages: BrokenImage[];
  isDark: boolean;
}

export function BrokenImagesPanel({ brokenImages, isDark }: BrokenImagesPanelProps) {
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

  if (brokenImages.length === 0) {
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
          No Broken Images Found
        </h3>
        <p
          className={`text-sm ${isDark ? "text-zinc-500" : "text-slate-500"}`}
        >
          All images are loading correctly
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {brokenImages.map((image, index) => (
        <div
          key={index}
          className={`rounded-xl border overflow-hidden transition-all ${
            isDark
              ? "bg-zinc-800/60 border-zinc-700 hover:border-orange-500/30"
              : "bg-white border-slate-200 hover:border-orange-300"
          }`}
        >
          {/* Header */}
          <div
            className={`px-4 py-3 cursor-pointer flex items-start gap-3 ${
              isDark ? "hover:bg-zinc-700/30" : "hover:bg-slate-50"
            }`}
            onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
          >
            <div
              className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-orange-500/20" : "bg-orange-100"
              }`}
            >
              <svg
                className={`w-5 h-5 ${isDark ? "text-orange-400" : "text-orange-600"}`}
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
            </div>
            <div className="flex-1 min-w-0">
              <div
                className={`font-medium text-sm truncate ${
                  isDark ? "text-zinc-100" : "text-slate-800"
                }`}
              >
                {image.src}
              </div>
              <div
                className={`text-xs mt-0.5 ${
                  isDark ? "text-orange-400/80" : "text-orange-600"
                }`}
              >
                {image.reason}
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
                    Image Source
                  </div>
                  <div className="flex items-center gap-2">
                    <code
                      className={`flex-1 text-xs px-3 py-2 rounded-lg break-all ${
                        isDark ? "bg-zinc-800 text-orange-400" : "bg-white text-orange-600"
                      }`}
                    >
                      {image.src}
                    </code>
                    <button
                      onClick={() => handleCopy(image.src, index)}
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
                    className={`text-xs uppercase tracking-wider mb-1 ${
                      isDark ? "text-zinc-500" : "text-slate-500"
                    }`}
                  >
                    Found On Page
                  </div>
                  <a
                    href={image.foundOnPage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-xs px-3 py-2 rounded-lg block break-all transition-colors ${
                      isDark
                        ? "bg-zinc-800 text-indigo-400 hover:text-indigo-300"
                        : "bg-white text-indigo-600 hover:text-indigo-500"
                    }`}
                  >
                    {image.foundOnPage}
                  </a>
                </div>

                <div>
                  <div
                    className={`text-xs uppercase tracking-wider mb-1 ${
                      isDark ? "text-zinc-500" : "text-slate-500"
                    }`}
                  >
                    Reason
                  </div>
                  <div
                    className={`text-sm px-3 py-2 rounded-lg ${
                      isDark ? "bg-zinc-800 text-red-400" : "bg-white text-red-600"
                    }`}
                  >
                    {image.reason}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div
                      className={`text-xs uppercase tracking-wider mb-1 ${
                        isDark ? "text-zinc-500" : "text-slate-500"
                      }`}
                    >
                      Alt Text
                    </div>
                    <div
                      className={`text-sm px-3 py-2 rounded-lg ${
                        isDark ? "bg-zinc-800 text-zinc-300" : "bg-white text-slate-700"
                      }`}
                    >
                      {image.altText || "[No alt text]"}
                    </div>
                  </div>
                  <div>
                    <div
                      className={`text-xs uppercase tracking-wider mb-1 ${
                        isDark ? "text-zinc-500" : "text-slate-500"
                      }`}
                    >
                      Location
                    </div>
                    <div
                      className={`text-sm px-3 py-2 rounded-lg font-mono ${
                        isDark ? "bg-zinc-800 text-amber-400" : "bg-white text-amber-600"
                      }`}
                    >
                      {image.elementContext}
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
