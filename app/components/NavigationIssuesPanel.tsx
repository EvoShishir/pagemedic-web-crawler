"use client";

import { NavigationIssue } from "../types/crawler";

interface NavigationIssuesPanelProps {
  navigationIssues: NavigationIssue[];
  isDark: boolean;
}

export function NavigationIssuesPanel({
  navigationIssues,
  isDark,
}: NavigationIssuesPanelProps) {
  if (navigationIssues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
            isDark ? "bg-zinc-800" : "bg-slate-100"
          }`}
        >
          <svg
            className={`w-8 h-8 ${isDark ? "text-zinc-600" : "text-slate-400"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>
        <h3
          className={`text-lg font-semibold mb-1 ${
            isDark ? "text-zinc-300" : "text-slate-700"
          }`}
        >
          No Navigation Issues
        </h3>
        <p
          className={`text-sm ${isDark ? "text-zinc-500" : "text-slate-500"}`}
        >
          All pages loaded successfully
        </p>
      </div>
    );
  }

  // Group issues by reason
  const groupedByReason = navigationIssues.reduce((acc, issue) => {
    const reason = issue.reason.split(":")[0] || issue.reason;
    if (!acc[reason]) {
      acc[reason] = [];
    }
    acc[reason].push(issue);
    return acc;
  }, {} as Record<string, NavigationIssue[]>);

  return (
    <div className="p-4 space-y-4">
      {/* Info banner */}
      <div
        className={`flex items-start gap-3 p-4 rounded-xl border ${
          isDark
            ? "bg-amber-500/10 border-amber-500/30"
            : "bg-amber-50 border-amber-200"
        }`}
      >
        <svg
          className={`w-5 h-5 shrink-0 mt-0.5 ${
            isDark ? "text-amber-400" : "text-amber-600"
          }`}
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
          <p
            className={`text-sm font-medium ${
              isDark ? "text-amber-400" : "text-amber-700"
            }`}
          >
            Navigation Issues (Not Broken Links)
          </p>
          <p
            className={`text-xs mt-1 ${
              isDark ? "text-amber-400/70" : "text-amber-600"
            }`}
          >
            These pages failed to load during crawling but may work when accessed directly.
            Common causes: timeouts, rate limiting, or temporary server issues.
          </p>
        </div>
      </div>

      {/* Issues by reason */}
      {Object.entries(groupedByReason).map(([reason, issues]) => (
        <div key={reason}>
          <h4
            className={`text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2 ${
              isDark ? "text-zinc-400" : "text-slate-500"
            }`}
          >
            <span
              className={`px-2 py-0.5 rounded text-xs ${
                isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700"
              }`}
            >
              {issues.length}
            </span>
            {reason}
          </h4>
          <div className="space-y-2">
            {issues.map((issue, index) => (
              <div
                key={`${issue.url}-${index}`}
                className={`p-4 rounded-xl border ${
                  isDark
                    ? "bg-zinc-800/50 border-zinc-700"
                    : "bg-white border-slate-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                      isDark ? "bg-amber-500/20" : "bg-amber-100"
                    }`}
                  >
                    <svg
                      className={`w-4 h-4 ${
                        isDark ? "text-amber-400" : "text-amber-600"
                      }`}
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
                  </div>
                  <div className="flex-1 min-w-0">
                    <a
                      href={issue.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-sm font-medium break-all hover:underline ${
                        isDark
                          ? "text-amber-400 hover:text-amber-300"
                          : "text-amber-700 hover:text-amber-600"
                      }`}
                    >
                      {issue.url}
                    </a>
                    <p
                      className={`text-xs mt-1 ${
                        isDark ? "text-zinc-500" : "text-slate-500"
                      }`}
                    >
                      Reason: {issue.reason}
                    </p>
                    <div
                      className={`flex items-center gap-4 mt-2 text-xs ${
                        isDark ? "text-zinc-500" : "text-slate-500"
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <svg
                          className="w-3 h-3"
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
                        Found on: {new URL(issue.foundOnPage).pathname || "/"}
                      </span>
                      {issue.linkText && issue.linkText !== "[Unknown]" && (
                        <span className="flex items-center gap-1 truncate">
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                            />
                          </svg>
                          &quot;{issue.linkText}&quot;
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
