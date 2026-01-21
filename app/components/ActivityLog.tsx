import { useState, useCallback } from "react";
import { LogEntry } from "./LogEntry";
import { EmptyState } from "./EmptyState";

interface ActivityLogProps {
  logs: string[];
  currentUrl: string | null;
  isCrawling: boolean;
  isDark: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
}

export function ActivityLog({
  logs,
  currentUrl,
  isCrawling,
  isDark,
  containerRef,
  onScroll,
}: ActivityLogProps) {
  const [showScrollButton, setShowScrollButton] = useState(false);

  const handleScroll = useCallback(() => {
    onScroll();
    
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      // Show button if scrolled more than 100px from bottom
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    }
  }, [onScroll, containerRef]);

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
      setShowScrollButton(false);
    }
  }, [containerRef]);

  return (
    <section
      className={`md:col-span-2 rounded-2xl overflow-hidden border relative ${
        isDark
          ? "bg-zinc-800/80 border-zinc-600/80"
          : "bg-white/80 border-slate-200"
      }`}
    >
      <div
        className={`px-6 py-4 border-b-2 flex items-center justify-between ${
          isDark ? "border-zinc-600/80" : "border-slate-200"
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isDark ? "bg-emerald-500/10" : "bg-emerald-100"
            }`}
          >
            <svg
              className={`w-4 h-4 ${
                isDark ? "text-emerald-400" : "text-emerald-600"
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 10h16M4 14h16M4 18h16"
              />
            </svg>
          </div>
          <h2
            className={`text-lg font-semibold ${
              isDark ? "text-zinc-100" : "text-slate-800"
            }`}
          >
            Activity Log
          </h2>
        </div>

        {isCrawling && (
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
              isDark ? "bg-indigo-500/10" : "bg-indigo-50"
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <span
              className={`text-xs font-medium ${
                isDark ? "text-indigo-400" : "text-indigo-600"
              }`}
            >
              Live
            </span>
          </div>
        )}
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className={`h-[calc(100vh-176px)] overflow-y-auto ${
          isDark
            ? "custom-scrollbar-dark bg-zinc-900"
            : "custom-scrollbar-light bg-slate-50"
        }`}
      >
        {logs.length === 0 ? (
          <EmptyState isDark={isDark} />
        ) : (
          <div className="p-4 font-mono text-sm space-y-0.5">
            {logs.map((log, index) => (
              <LogEntry
                key={index}
                log={log}
                index={index}
                currentUrl={currentUrl}
                isDark={isDark}
              />
            ))}
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && logs.length > 0 && (
        <button
          onClick={scrollToBottom}
          className={`cursor-pointer absolute bottom-4 right-6 flex items-center gap-2 p-4 rounded-full shadow-lg transition-all duration-200 hover:scale-105 ${
            isDark
              ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/25"
              : "bg-indigo-500 hover:bg-indigo-600 text-white shadow-indigo-500/30"
          }`}
        >
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
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </button>
      )}
    </section>
  );
}
