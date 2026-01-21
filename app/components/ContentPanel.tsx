"use client";

import React, { useState, useCallback } from "react";
import { LogEntry } from "./LogEntry";
import { EmptyState } from "./EmptyState";
import { BrokenLinksPanel } from "./BrokenLinksPanel";
import { BrokenImagesPanel } from "./BrokenImagesPanel";
import { ConsoleErrorsPanel } from "./ConsoleErrorsPanel";
import { NavigationIssuesPanel } from "./NavigationIssuesPanel";
import { BrokenLink, BrokenImage, ConsoleError, NavigationIssue } from "../types/crawler";

type TabType = "logs" | "broken-links" | "broken-images" | "console-errors" | "nav-issues";

interface ContentPanelProps {
  logs: string[];
  brokenLinks: BrokenLink[];
  brokenImages: BrokenImage[];
  consoleErrors: ConsoleError[];
  navigationIssues: NavigationIssue[];
  currentUrl: string | null;
  isCrawling: boolean;
  isDark: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
}

export function ContentPanel({
  logs,
  brokenLinks,
  brokenImages,
  consoleErrors,
  navigationIssues,
  currentUrl,
  isCrawling,
  isDark,
  containerRef,
  onScroll,
}: ContentPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("logs");
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

  const tabs: { id: TabType; label: string; count?: number; icon: React.ReactNode }[] = [
    {
      id: "logs",
      label: "Activity Log",
      icon: (
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
            d="M4 6h16M4 10h16M4 14h16M4 18h16"
          />
        </svg>
      ),
    },
    
    {
      id: "broken-links",
      label: "Broken Links",
      count: brokenLinks.length,
      icon: (
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
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
          />
        </svg>
      ),
    },
    {
      id: "nav-issues",
      label: "Nav Issues",
      count: navigationIssues.length,
      icon: (
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
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
      ),
    },
    {
      id: "broken-images",
      label: "Broken Images",
      count: brokenImages.length,
      icon: (
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
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      id: "console-errors",
      label: "Console Errors",
      count: consoleErrors.length,
      icon: (
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
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ),
    },
    
  ];

  return (
    <section
      className={`md:col-span-2 rounded-2xl overflow-hidden border relative ${
        isDark
          ? "bg-zinc-800/80 border-zinc-600/80"
          : "bg-white/80 border-slate-200"
      }`}
    >
      {/* Tab Navigation */}
      <div
        className={`px-4 py-2 border-b flex items-center gap-1 overflow-x-auto ${
          isDark ? "border-zinc-600/80" : "border-slate-200"
        }`}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`cursor-pointer flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? isDark
                  ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                  : "bg-indigo-50 text-indigo-600 border border-indigo-200"
                : isDark
                ? "text-zinc-400 hover:text-zinc-200 border border-transparent hover:bg-zinc-700/50"
                : "text-slate-500 hover:text-slate-700 border border-transparent hover:bg-slate-100"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  tab.id === "broken-links"
                    ? isDark
                      ? "bg-red-500/20 text-red-400"
                      : "bg-red-100 text-red-600"
                    : tab.id === "broken-images"
                    ? isDark
                      ? "bg-orange-500/20 text-orange-400"
                      : "bg-orange-100 text-orange-600"
                    : tab.id === "nav-issues"
                    ? isDark
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-amber-100 text-amber-600"
                    : isDark
                    ? "bg-violet-500/20 text-violet-400"
                    : "bg-violet-100 text-violet-600"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}

        {isCrawling && (
          <div
            className={`ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full shrink-0 ${
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

      {/* Content Area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className={`h-[calc(100vh-161px)] overflow-y-auto ${
          isDark
            ? "custom-scrollbar-dark bg-zinc-900"
            : "custom-scrollbar-light bg-slate-50"
        }`}
      >
        {activeTab === "logs" && (
          <>
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
          </>
        )}

        {activeTab === "broken-links" && (
          <BrokenLinksPanel brokenLinks={brokenLinks} isDark={isDark} />
        )}

        {activeTab === "broken-images" && (
          <BrokenImagesPanel brokenImages={brokenImages} isDark={isDark} />
        )}

        {activeTab === "console-errors" && (
          <ConsoleErrorsPanel consoleErrors={consoleErrors} isDark={isDark} />
        )}

        {activeTab === "nav-issues" && (
          <NavigationIssuesPanel navigationIssues={navigationIssues} isDark={isDark} />
        )}
      </div>

      {/* Scroll to bottom button - only show on logs tab */}
      {showScrollButton && activeTab === "logs" && logs.length > 0 && (
        <button
          onClick={scrollToBottom}
          className={`cursor-pointer absolute bottom-4 right-6 flex items-center gap-2 p-4 rounded-full shadow-lg transition-all duration-200 hover:scale-105 z-10 ${
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
