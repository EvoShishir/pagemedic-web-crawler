import { useState } from "react";
import { parseLogMessage, extractCrawlingUrl } from "../utils/logParser";
import { getLogStyle, getLinkStyle } from "../utils/logStyles";

interface LogEntryProps {
  log: string;
  index: number;
  currentUrl: string | null;
  isDark: boolean;
}

export function LogEntry({ log, index, currentUrl, isDark }: LogEntryProps) {
  const [copied, setCopied] = useState(false);
  const crawlingMatch = extractCrawlingUrl(log);
  const isCurrentLog =
    crawlingMatch && currentUrl && crawlingMatch === currentUrl;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(log);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div
      className={`group log-entry py-2 px-3 rounded-lg flex items-center gap-3 transition-colors relative ${
        isCurrentLog
          ? isDark
            ? "bg-indigo-500/10 border border-indigo-500/20"
            : "bg-indigo-50 border border-indigo-200"
          : isDark
          ? "hover:bg-zinc-800"
          : "hover:bg-white"
      }`}
    >
      <span className={`flex-1 ${getLogStyle(log, isDark)}`}>
        {parseLogMessage(log).map((part, partIndex) => {
          const urlPattern = /(https?:\/\/[^\s]+)/g;
          if (typeof part === "string" && part.match(urlPattern)) {
            return (
              <a
                key={`${index}-${partIndex}`}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className={`${getLinkStyle(
                  isDark
                )} underline underline-offset-2 transition-colors`}
              >
                {part}
              </a>
            );
          }
          return <span key={`${index}-${partIndex}`}>{part}</span>;
        })}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        {isCurrentLog && (
          <svg
            className={`animate-spin h-4 w-4 ${
              isDark ? "text-indigo-400" : "text-indigo-500"
            }`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {!isCurrentLog && (<button
          onClick={handleCopy}
          className={`cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md ${
            isDark
              ? "hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200"
              : "hover:bg-slate-200 text-slate-500 hover:text-slate-700"
          }`}
          title={copied ? "Copied!" : "Copy log"}
          aria-label="Copy log to clipboard"
        >
          {copied ? (
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
        </button>)}
      </div>
    </div>
  );
}
