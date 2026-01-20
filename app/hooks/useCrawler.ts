import { useState, useCallback } from "react";
import { extractCrawlingUrl } from "../utils/logParser";
import { BrokenLink, BrokenImage, ConsoleError, NavigationIssue, CrawlerEventData, DiscoveryEventData } from "../types/crawler";

export type CrawlerPhase = "idle" | "discovering" | "preview" | "crawling";

export interface DiscoveryProgress {
  message: string;
  total: number;
  fromSitemap: number;
  pagesScanned: number;
  phase: string;
}

export interface AlertState {
  isOpen: boolean;
  title: string;
  message: string;
  type: "error" | "warning" | "info";
}

export function useCrawler() {
  const [logs, setLogs] = useState<string[]>([]);
  const [brokenLinks, setBrokenLinks] = useState<BrokenLink[]>([]);
  const [brokenImages, setBrokenImages] = useState<BrokenImage[]>([]);
  const [consoleErrors, setConsoleErrors] = useState<ConsoleError[]>([]);
  const [navigationIssues, setNavigationIssues] = useState<NavigationIssue[]>([]);
  const [isCrawling, setIsCrawling] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  
  // Link preview states
  const [phase, setPhase] = useState<CrawlerPhase>("idle");
  const [discoveredLinks, setDiscoveredLinks] = useState<string[]>([]);
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set());
  const [pendingStartUrl, setPendingStartUrl] = useState<string>("");
  const [pendingSitemapUrl, setPendingSitemapUrl] = useState<string>("");
  const [pendingResetCallback, setPendingResetCallback] = useState<(() => void) | null>(null);

  // Discovery progress state
  const [discoveryProgress, setDiscoveryProgress] = useState<DiscoveryProgress | null>(null);
  const [discoveryEventSource, setDiscoveryEventSource] = useState<EventSource | null>(null);

  // Alert dialog state
  const [alertState, setAlertState] = useState<AlertState>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  const showAlert = useCallback((title: string, message: string, type: AlertState["type"] = "info") => {
    setAlertState({ isOpen: true, title, message, type });
  }, []);

  const closeAlert = useCallback(() => {
    setAlertState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Cancel discovery
  const cancelDiscovery = useCallback(() => {
    if (discoveryEventSource) {
      discoveryEventSource.close();
      setDiscoveryEventSource(null);
    }
    setPhase("idle");
    setDiscoveryProgress(null);
    setDiscoveredLinks([]);
    setSelectedLinks(new Set());
    setPendingStartUrl("");
    setPendingSitemapUrl("");
    setPendingResetCallback(null);
  }, [discoveryEventSource]);

  // Discover links (first phase) - now uses SSE
  const discoverLinks = useCallback(
    (startUrl: string, sitemapUrl: string, onResetAutoScroll?: () => void) => {
      if (!startUrl) {
        showAlert("Missing URL", "Please enter a start URL to begin discovery.", "warning");
        return;
      }

      // Cancel any existing discovery
      if (discoveryEventSource) {
        discoveryEventSource.close();
      }

      setPhase("discovering");
      setPendingStartUrl(startUrl);
      setPendingSitemapUrl(sitemapUrl);
      setPendingResetCallback(() => onResetAutoScroll || null);
      setDiscoveryProgress({
        message: "Starting discovery...",
        total: 0,
        fromSitemap: 0,
        pagesScanned: 0,
        phase: "starting",
      });

        const params = new URLSearchParams({ startUrl });
        if (sitemapUrl) {
          params.append("sitemapUrl", sitemapUrl);
        }

      const es = new EventSource(`/api/discover?${params.toString()}`);

      es.onmessage = (event) => {
        const data: DiscoveryEventData = JSON.parse(event.data);

        if (data.type === "status") {
          setDiscoveryProgress({
            message: data.message,
            total: data.total || 0,
            fromSitemap: data.fromSitemap || 0,
            pagesScanned: data.pagesScanned || 0,
            phase: data.phase || "unknown",
          });
        } else if (data.type === "done") {
          const links = data.links || [];
          setDiscoveredLinks(links);
          setSelectedLinks(new Set(links)); // Select all by default
          setDiscoveryProgress({
            message: data.message,
            total: data.total || links.length,
            fromSitemap: data.fromSitemap || 0,
            pagesScanned: data.pagesScanned || 0,
            phase: "done",
          });
          es.close();
          setDiscoveryEventSource(null);
          setPhase("preview");
        } else if (data.type === "error") {
          showAlert("Discovery Failed", data.message || "An unknown error occurred during discovery.", "error");
          es.close();
          setDiscoveryEventSource(null);
          setPhase("idle");
          setDiscoveryProgress(null);
        }
      };

      es.onerror = () => {
        showAlert("Connection Lost", "The discovery connection was lost. Please try again.", "error");
        es.close();
        setDiscoveryEventSource(null);
        setPhase("idle");
        setDiscoveryProgress(null);
      };

      setDiscoveryEventSource(es);
    },
    [discoveryEventSource, showAlert]
  );

  // Start crawl with selected links
  const startCrawlWithSelection = useCallback(() => {
    if (selectedLinks.size === 0) {
      showAlert("No Links Selected", "Please select at least one link to crawl.", "warning");
      return;
    }

    setPhase("crawling");
    setLogs([]);
    setBrokenLinks([]);
    setBrokenImages([]);
    setConsoleErrors([]);
    setNavigationIssues([]);
    setIsCrawling(true);
    setDiscoveryProgress(null);
    pendingResetCallback?.();

    // Use POST request with fetch to avoid URL length limits
    const abortController = new AbortController();
    
    (async () => {
      try {
        const response = await fetch("/api/crawl", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startUrl: pendingStartUrl,
            sitemapUrl: pendingSitemapUrl || undefined,
            selectedUrls: [...selectedLinks],
            // Pass all discovered URLs so sitemap links can be skipped from validation
            allDiscoveredUrls: discoveredLinks,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          
          // Parse SSE messages from buffer
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data: CrawlerEventData = JSON.parse(line.slice(6));

      if (data.type === "log") {
        setLogs((prev) => [...prev, data.message!]);
        const url = extractCrawlingUrl(data.message!);
        if (url) {
          setCurrentUrl(url);
        }
      } else if (data.type === "broken_link") {
        setLogs((prev) => [...prev, data.message!]);
        if (data.data) {
          setBrokenLinks((prev) => [...prev, data.data as BrokenLink]);
        }
      } else if (data.type === "broken_image") {
        setLogs((prev) => [...prev, data.message!]);
        if (data.data) {
          setBrokenImages((prev) => [...prev, data.data as BrokenImage]);
        }
      } else if (data.type === "console_error") {
        if (data.data) {
          setConsoleErrors((prev) => [...prev, data.data as ConsoleError]);
        }
                } else if (data.type === "navigation_issue") {
                  setLogs((prev) => [...prev, data.message!]);
                  if (data.data) {
                    setNavigationIssues((prev) => [...prev, data.data as NavigationIssue]);
                  }
      } else if (data.type === "prompt") {
        const shouldContinue = window.confirm(data.message!);
        fetch("/api/crawl/response", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: data.sessionId,
            response: shouldContinue ? "y" : "n",
          }),
        });
      } else if (data.type === "done") {
        setLogs((prev) => [...prev, data.message!]);
        setCurrentUrl(null);
        setIsCrawling(false);
        setPhase("idle");
      } else if (data.type === "error") {
        setLogs((prev) => [...prev, `❌ Error: ${data.message}`]);
        setCurrentUrl(null);
                  setIsCrawling(false);
                  setPhase("idle");
                }
              } catch {
                // Ignore parse errors for incomplete messages
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setLogs((prev) => [...prev, `❌ Connection error: ${err.message}`]);
          showAlert("Connection Error", `Failed to start crawl: ${err.message}`, "error");
        }
        setIsCrawling(false);
        setCurrentUrl(null);
        setPhase("idle");
      }
    })();

    // Store abort controller to allow stopping
    setEventSource({ close: () => abortController.abort() } as EventSource);
  }, [selectedLinks, pendingStartUrl, pendingSitemapUrl, pendingResetCallback, showAlert]);

  // Cancel link preview
  const cancelPreview = useCallback(() => {
    setPhase("idle");
    setDiscoveredLinks([]);
    setSelectedLinks(new Set());
    setPendingStartUrl("");
    setPendingSitemapUrl("");
    setPendingResetCallback(null);
    setDiscoveryProgress(null);
  }, []);

  // Legacy direct crawl (bypasses preview)
  const handleStartCrawl = useCallback(
    (startUrl: string, sitemapUrl: string, onResetAutoScroll?: () => void) => {
      if (!startUrl) {
        showAlert("Missing URL", "Please enter a start URL to begin crawling.", "warning");
        return;
      }

      setPhase("crawling");
      setLogs([]);
      setBrokenLinks([]);
      setBrokenImages([]);
      setConsoleErrors([]);
      setNavigationIssues([]);
      setIsCrawling(true);
      onResetAutoScroll?.();

      const params = new URLSearchParams({ startUrl });
      if (sitemapUrl) {
        params.append("sitemapUrl", sitemapUrl);
      }

      const es = new EventSource(`/api/crawl?${params.toString()}`);

      es.onmessage = (event) => {
        const data: CrawlerEventData = JSON.parse(event.data);

        if (data.type === "log") {
          setLogs((prev) => [...prev, data.message!]);
          const url = extractCrawlingUrl(data.message!);
          if (url) {
            setCurrentUrl(url);
          }
        } else if (data.type === "broken_link") {
          setLogs((prev) => [...prev, data.message!]);
          if (data.data) {
            setBrokenLinks((prev) => [...prev, data.data as BrokenLink]);
          }
        } else if (data.type === "broken_image") {
          setLogs((prev) => [...prev, data.message!]);
          if (data.data) {
            setBrokenImages((prev) => [...prev, data.data as BrokenImage]);
          }
        } else if (data.type === "console_error") {
          if (data.data) {
            setConsoleErrors((prev) => [...prev, data.data as ConsoleError]);
          }
        } else if (data.type === "navigation_issue") {
          setLogs((prev) => [...prev, data.message!]);
          if (data.data) {
            setNavigationIssues((prev) => [...prev, data.data as NavigationIssue]);
          }
        } else if (data.type === "prompt") {
          const shouldContinue = window.confirm(data.message!);
          fetch("/api/crawl/response", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: data.sessionId,
              response: shouldContinue ? "y" : "n",
            }),
          });
        } else if (data.type === "done") {
          setLogs((prev) => [...prev, data.message!]);
          setCurrentUrl(null);
          es.close();
          setIsCrawling(false);
          setEventSource(null);
          setPhase("idle");
        } else if (data.type === "error") {
          setLogs((prev) => [...prev, `❌ Error: ${data.message}`]);
          setCurrentUrl(null);
          es.close();
          setIsCrawling(false);
          setEventSource(null);
          setPhase("idle");
        }
      };

      es.onerror = () => {
        setLogs((prev) => [...prev, "❌ Connection lost"]);
        es.close();
        setIsCrawling(false);
        setCurrentUrl(null);
        setEventSource(null);
        setPhase("idle");
      };

      setEventSource(es);
    },
    [showAlert]
  );

  const handleStop = useCallback(() => {
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
    }
    if (discoveryEventSource) {
      discoveryEventSource.close();
      setDiscoveryEventSource(null);
    }
    setIsCrawling(false);
    setCurrentUrl(null);
    setLogs((prev) => [...prev, "⏹️ Crawling stopped by user"]);
    setPhase("idle");
    setDiscoveryProgress(null);
  }, [eventSource, discoveryEventSource]);

  return {
    logs,
    brokenLinks,
    brokenImages,
    consoleErrors,
    navigationIssues,
    isCrawling,
    currentUrl,
    handleStartCrawl,
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
    // Discovery progress
    discoveryProgress,
    // Alert dialog
    alertState,
    closeAlert,
  };
}
