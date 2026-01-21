"use client";

import { useTheme } from "./hooks/useTheme";
import { useCrawler } from "./hooks/useCrawler";
import { useStats } from "./hooks/useStats";
import { useAutoScroll } from "./hooks/useAutoScroll";
import { ConfigCard } from "./components/ConfigCard";
import { ContentPanel } from "./components/ContentPanel";
import { Header } from "./components/Header";
import { LinkPreviewPanel } from "./components/LinkPreviewPanel";
import { 
  HiOutlineMagnifyingGlass, 
  HiOutlineDocumentText, 
  HiOutlineCheckCircle, 
  HiOutlineExclamationTriangle, 
  HiOutlineInformationCircle, 
  HiOutlineGlobeAlt,
  HiOutlineClock,
  HiOutlineRocketLaunch
} from "react-icons/hi2";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Home() {
  const { isDark, toggleTheme } = useTheme();
  const {
    logs,
    brokenLinks,
    brokenImages,
    consoleErrors,
    navigationIssues,
    isCrawling,
    currentUrl,
    handleStop,
    // Link preview
    phase,
    discoveredLinks,
    selectedLinks,
    setSelectedLinks,
    discoverLinks,
    startCrawlWithSelection,
    cancelPreview,
    cancelDiscovery,
    discoveryProgress,
    alertState,
    closeAlert,
  } = useCrawler();
  const stats = useStats(logs, brokenLinks, brokenImages, consoleErrors, navigationIssues);
  const { containerRef, handleScroll, resetAutoScroll } = useAutoScroll([logs]);

  const handleStart = (startUrl: string, sitemapUrl: string, cssSelector: string) => {
    discoverLinks(startUrl, sitemapUrl, cssSelector, resetAutoScroll);
  };

  const isDisabled = phase === "discovering" || phase === "crawling";

  // Get phase icon component
  const getPhaseIcon = (phaseType: string) => {
    const iconClass = `w-6 h-6 ${isDark ? "text-indigo-400" : "text-indigo-600"}`;
    
    switch (phaseType) {
      case "starting":
        return <HiOutlineRocketLaunch className={iconClass} />;
      case "sitemap":
      case "sitemap_detect":
        return <HiOutlineDocumentText className={iconClass} />;
      case "sitemap_done":
        return <HiOutlineCheckCircle className={`w-6 h-6 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />;
      case "sitemap_error":
        return <HiOutlineExclamationTriangle className={`w-6 h-6 ${isDark ? "text-amber-400" : "text-amber-600"}`} />;
      case "sitemap_not_found":
        return <HiOutlineInformationCircle className={iconClass} />;
      case "browser":
        return <HiOutlineGlobeAlt className={iconClass} />;
      case "scanning":
        return <HiOutlineMagnifyingGlass className={iconClass} />;
      default:
        return <HiOutlineClock className={iconClass} />;
    }
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDark
          ? "bg-zinc-800 gradient-bg-dark text-white"
          : "bg-slate-50 gradient-bg-light text-slate-900"
      }`}
    >
      <Header isDark={isDark} onToggleTheme={toggleTheme} />
      <main className="px-6 py-4 grid md:grid-cols-3 gap-4">
        <ConfigCard
          isDark={isDark}
          onToggleTheme={toggleTheme}
          stats={stats}
          isCrawling={isDisabled}
          onStartCrawl={handleStart}
          onStop={handleStop}
        />

        {phase === "discovering" ? (
          <section
            className={`h-[calc(100vh-100px)] md:col-span-2 rounded-2xl overflow-hidden border ${
              isDark
                ? "bg-zinc-800/80 border-zinc-600/80"
                : "bg-white/80 border-slate-200"
            }`}
          >
            <div className="flex flex-col items-center justify-center h-full py-16 px-8">
              {/* Spinner */}
              <div className="relative mb-8">
              <div
                  className={`w-20 h-20 rounded-full border-4 border-t-transparent animate-spin ${
                  isDark ? "border-indigo-500" : "border-indigo-400"
                }`}
              />
                <div className="absolute inset-0 flex items-center justify-center">
                  {discoveryProgress ? getPhaseIcon(discoveryProgress.phase) : <HiOutlineMagnifyingGlass className={`w-6 h-6 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />}
                </div>
              </div>

              {/* Title */}
              <h3
                className={`text-xl font-semibold mb-3 ${
                  isDark ? "text-white" : "text-slate-800"
                }`}
              >
                Discovering Links
              </h3>

              {/* Status message */}
              <p
                className={`text-sm mb-6 text-center max-w-md ${
                  isDark ? "text-zinc-400" : "text-slate-500"
                }`}
              >
                {discoveryProgress?.message || "Initializing..."}
              </p>

              {/* Stats cards */}
              {discoveryProgress && (
                <div className="grid grid-cols-3 gap-4 mb-8 w-full max-w-lg">
                  {/* Total Links */}
                  <div
                    className={`flex flex-col items-center p-4 rounded-xl border ${
                      isDark
                        ? "bg-zinc-700/50 border-zinc-600"
                        : "bg-slate-100 border-slate-200"
                    }`}
                  >
                    <span
                      className={`text-3xl font-bold tabular-nums ${
                        isDark ? "text-indigo-400" : "text-indigo-600"
                      }`}
                    >
                      {discoveryProgress.total}
                    </span>
                    <span
                      className={`text-xs uppercase tracking-wider mt-1 ${
                        isDark ? "text-zinc-400" : "text-slate-500"
                      }`}
                    >
                      Total Links
                    </span>
                  </div>

                  {/* From Sitemap */}
                  <div
                    className={`flex flex-col items-center p-4 rounded-xl border ${
                      isDark
                        ? "bg-zinc-700/50 border-zinc-600"
                        : "bg-slate-100 border-slate-200"
                    }`}
                  >
                    <span
                      className={`text-3xl font-bold tabular-nums ${
                        discoveryProgress.fromSitemap > 0
                          ? isDark
                            ? "text-emerald-400"
                            : "text-emerald-600"
                          : isDark
                          ? "text-zinc-500"
                          : "text-slate-400"
                      }`}
                    >
                      {discoveryProgress.fromSitemap}
                    </span>
                    <span
                      className={`text-xs uppercase tracking-wider mt-1 ${
                        isDark ? "text-zinc-400" : "text-slate-500"
                      }`}
                    >
                      From Sitemap
                    </span>
                  </div>

                  {/* Pages Scanned */}
                  <div
                    className={`flex flex-col items-center p-4 rounded-xl border ${
                      isDark
                        ? "bg-zinc-700/50 border-zinc-600"
                        : "bg-slate-100 border-slate-200"
                    }`}
                  >
                    <span
                      className={`text-3xl font-bold tabular-nums ${
                        discoveryProgress.pagesScanned > 0
                          ? isDark
                            ? "text-amber-400"
                            : "text-amber-600"
                          : isDark
                          ? "text-zinc-500"
                          : "text-slate-400"
                      }`}
                    >
                      {discoveryProgress.pagesScanned}
                    </span>
                    <span
                      className={`text-xs uppercase tracking-wider mt-1 ${
                        isDark ? "text-zinc-400" : "text-slate-500"
                      }`}
                    >
                      Pages Scanned
                    </span>
                  </div>
                </div>
              )}

              {/* Progress indicator for page scanning (only when no sitemap) */}
              {discoveryProgress?.pagesScanned !== undefined && discoveryProgress.pagesScanned > 0 && discoveryProgress.fromSitemap === 0 && (
                <div className="w-full max-w-lg mb-6">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div
                      className={`w-2 h-2 rounded-full animate-pulse ${
                        isDark ? "bg-indigo-500" : "bg-indigo-400"
                      }`}
                    />
                    <p
                      className={`text-sm font-medium ${
                        isDark ? "text-zinc-300" : "text-slate-600"
                      }`}
                    >
                      Crawling all pages to discover links...
                    </p>
                  </div>
                  <p
                    className={`text-xs text-center ${
                      isDark ? "text-zinc-500" : "text-slate-400"
                    }`}
                  >
                    {discoveryProgress.pagesScanned} pages scanned • {discoveryProgress.total} links found
                  </p>
                </div>
              )}

              {/* Progress bar for sitemap processing */}
              {discoveryProgress?.phase === "sitemap" && discoveryProgress.message.includes("/") && (
                <div className="w-full max-w-lg mb-6">
                  <div
                    className={`h-2 rounded-full overflow-hidden ${
                      isDark ? "bg-zinc-700" : "bg-slate-200"
                    }`}
                  >
                    <div
                      className="h-full bg-linear-to-r from-emerald-500 to-teal-500 transition-all duration-300 animate-pulse"
                      style={{ width: "100%" }}
                    />
                  </div>
                  <p
                    className={`text-xs text-center mt-2 ${
                      isDark ? "text-zinc-500" : "text-slate-400"
                    }`}
                  >
                    Processing sitemap...
                  </p>
                </div>
              )}

              {/* Cancel button */}
              <button
                onClick={cancelDiscovery}
                className={`cursor-pointer px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isDark
                    ? "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                    : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                }`}
              >
                Cancel
              </button>
            </div>
          </section>
        ) : phase === "preview" ? (
          <section
            className={`md:col-span-2 rounded-2xl overflow-hidden border ${
              isDark
                ? "bg-zinc-800/80 border-zinc-600/80"
                : "bg-white/80 border-slate-200"
            }`}
          >
            <LinkPreviewPanel
              links={discoveredLinks}
              selectedLinks={selectedLinks}
              onSelectionChange={setSelectedLinks}
              onConfirm={startCrawlWithSelection}
              onCancel={cancelPreview}
              isDark={isDark}
            />
          </section>
        ) : (
          <ContentPanel
            logs={logs}
            brokenLinks={brokenLinks}
            brokenImages={brokenImages}
            consoleErrors={consoleErrors}
            navigationIssues={navigationIssues}
            currentUrl={currentUrl}
            isCrawling={isCrawling}
            isDark={isDark}
            containerRef={containerRef}
            onScroll={handleScroll}
          />
        )}
      </main>

      {/* Alert Dialog */}
      <AlertDialog open={alertState.isOpen} onOpenChange={(open) => !open && closeAlert()}>
        <AlertDialogContent className={isDark ? "bg-zinc-900 border-zinc-700" : ""}>
          <AlertDialogHeader>
            <AlertDialogTitle className={`flex items-center gap-2 ${isDark ? "text-white" : ""}`}>
              {alertState.type === "error" && (
                <HiOutlineExclamationTriangle className="w-5 h-5 text-red-500" />
              )}
              {alertState.type === "warning" && (
                <HiOutlineExclamationTriangle className="w-5 h-5 text-amber-500" />
              )}
              {alertState.type === "info" && (
                <HiOutlineInformationCircle className="w-5 h-5 text-blue-500" />
              )}
              {alertState.title}
            </AlertDialogTitle>
            <AlertDialogDescription className={isDark ? "text-zinc-400" : ""}>
              {alertState.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={closeAlert}
              className={
                alertState.type === "error"
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : alertState.type === "warning"
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
