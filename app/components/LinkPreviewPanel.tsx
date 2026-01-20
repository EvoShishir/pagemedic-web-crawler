"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface LinkPreviewPanelProps {
  links: string[];
  selectedLinks: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isDark: boolean;
}

export function LinkPreviewPanel({
  links,
  selectedLinks,
  onSelectionChange,
  onConfirm,
  onCancel,
  isDark,
}: LinkPreviewPanelProps) {
  // Anchor index is the starting point for shift+click range selection
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null);
  // The action that will be applied to the range (select or deselect)
  const [anchorAction, setAnchorAction] = useState<"select" | "deselect">("select");
  // Track if shift is being held for visual preview
  const [isShiftHeld, setIsShiftHeld] = useState(false);
  // Current hover index for showing range preview
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Track shift key state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") setIsShiftHeld(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setIsShiftHeld(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Filter links based on search
  const filteredLinks = links.filter((link) =>
    link.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Reset anchor when search changes (indices become invalid)
  useEffect(() => {
    setAnchorIndex(null);
    setHoverIndex(null);
  }, [searchQuery]);

  // Get display path from URL
  const getDisplayPath = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname + urlObj.search;
    } catch {
      return url;
    }
  };

  // Calculate the range that would be affected by shift+click
  const getPreviewRange = useCallback((): { start: number; end: number; action: "select" | "deselect" } | null => {
    if (!isShiftHeld || anchorIndex === null || hoverIndex === null) return null;
    const start = Math.min(anchorIndex, hoverIndex);
    const end = Math.max(anchorIndex, hoverIndex);
    return { start, end, action: anchorAction };
  }, [isShiftHeld, anchorIndex, hoverIndex, anchorAction]);

  const previewRange = getPreviewRange();

  // Check if an index is in the preview range
  const isInPreviewRange = useCallback((index: number): boolean => {
    if (!previewRange) return false;
    return index >= previewRange.start && index <= previewRange.end;
  }, [previewRange]);

  // Handle individual link toggle
  const handleLinkClick = useCallback(
    (link: string, index: number, event: React.MouseEvent) => {
      const newSelection = new Set(selectedLinks);

      if (event.shiftKey && anchorIndex !== null) {
        // Shift+click: apply anchor action to entire range
        const start = Math.min(anchorIndex, index);
        const end = Math.max(anchorIndex, index);

        for (let i = start; i <= end; i++) {
          if (anchorAction === "select") {
            newSelection.add(filteredLinks[i]);
          } else {
            newSelection.delete(filteredLinks[i]);
          }
        }
        // Don't update anchor on shift+click - allows extending range
      } else {
        // Normal click: toggle single and set as new anchor
        const wasSelected = newSelection.has(link);
        if (wasSelected) {
          newSelection.delete(link);
          // Next shift+click will deselect the range
          setAnchorAction("deselect");
        } else {
          newSelection.add(link);
          // Next shift+click will select the range
          setAnchorAction("select");
        }
        setAnchorIndex(index);
      }

      onSelectionChange(newSelection);
    },
    [selectedLinks, anchorIndex, anchorAction, filteredLinks, onSelectionChange]
  );

  // Select/deselect all
  const handleSelectAll = useCallback(() => {
    if (selectedLinks.size === links.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(links));
    }
  }, [links, selectedLinks, onSelectionChange]);

  // Select/deselect filtered
  const handleSelectFiltered = useCallback(() => {
    const newSelection = new Set(selectedLinks);
    const allFilteredSelected = filteredLinks.every((link) =>
      selectedLinks.has(link)
    );

    for (const link of filteredLinks) {
      if (allFilteredSelected) {
        newSelection.delete(link);
      } else {
        newSelection.add(link);
      }
    }

    onSelectionChange(newSelection);
  }, [filteredLinks, selectedLinks, onSelectionChange]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        onConfirm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, onConfirm]);

  const selectedCount = selectedLinks.size;
  const totalCount = links.length;
  const deselectedCount = totalCount - selectedCount;

  return (
    <div
      className={`flex flex-col h-[calc(100vh-138px)] ${
        isDark ? "bg-zinc-900" : "bg-slate-50"
      }`}
    >
      {/* Header */}
      <div
        className={`px-4 py-3 border-b sticky top-0 z-10 ${
          isDark
            ? "bg-zinc-800/95 border-zinc-700 backdrop-blur-sm"
            : "bg-white/95 border-slate-200 backdrop-blur-sm"
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isDark ? "bg-indigo-500/20" : "bg-indigo-100"
              }`}
            >
              <svg
                className={`w-5 h-5 ${
                  isDark ? "text-indigo-400" : "text-indigo-600"
                }`}
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
            </div>
            <div>
              <h3
                className={`font-semibold ${
                  isDark ? "text-white" : "text-slate-800"
                }`}
              >
                Link Queue Preview
              </h3>
              <p
                className={`text-xs ${
                  isDark ? "text-zinc-400" : "text-slate-500"
                }`}
              >
                {isShiftHeld && anchorIndex !== null ? (
                  <span className={isDark ? "text-amber-400" : "text-amber-600"}>
                    Click to {anchorAction} range from anchor (⚓)
                  </span>
                ) : (
                  "Click to toggle • Hold Shift to select range"
                )}
              </p>
            </div>
          </div>

          {/* Stats badges */}
          <div className="flex items-center gap-2">
            {/* Show range preview count when shift is held */}
            {previewRange && (
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold animate-pulse ${
                  previewRange.action === "select"
                    ? isDark
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-amber-100 text-amber-600"
                    : isDark
                    ? "bg-orange-500/20 text-orange-400"
                    : "bg-orange-100 text-orange-600"
                }`}
              >
                {previewRange.action === "select" ? "+" : "−"}{previewRange.end - previewRange.start + 1} in range
              </span>
            )}
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                isDark
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-emerald-100 text-emerald-600"
              }`}
            >
              {selectedCount} selected
            </span>
            {deselectedCount > 0 && (
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  isDark
                    ? "bg-red-500/20 text-red-400"
                    : "bg-red-100 text-red-600"
                }`}
              >
                {deselectedCount} excluded
              </span>
            )}
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                isDark
                  ? "bg-zinc-700 text-zinc-300"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {totalCount} total
            </span>
          </div>
        </div>

        {/* Search and bulk actions */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <svg
              className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                isDark ? "text-zinc-500" : "text-slate-400"
              }`}
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
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter links..."
              className={`w-full pl-10 pr-4 py-2 rounded-lg text-sm border transition-colors ${
                isDark
                  ? "bg-zinc-800 border-zinc-600 text-white placeholder-zinc-500 focus:border-indigo-500"
                  : "bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-400"
              } focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
            />
          </div>

          <button
            onClick={handleSelectAll}
            className={`cursor-pointer px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              isDark
                ? "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                : "bg-slate-200 text-slate-600 hover:bg-slate-300"
            }`}
          >
            {selectedLinks.size === links.length ? "Deselect All" : "Select All"}
          </button>

          {searchQuery && filteredLinks.length !== links.length && (
            <button
              onClick={handleSelectFiltered}
              className={`cursor-pointer px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isDark
                  ? "bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30"
                  : "bg-indigo-100 text-indigo-600 hover:bg-indigo-200"
              }`}
            >
              Toggle Filtered ({filteredLinks.length})
            </button>
          )}
        </div>
      </div>

      {/* Link list */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-y-auto ${
          isDark ? "custom-scrollbar-dark" : "custom-scrollbar-light"
        }`}
      >
        {filteredLinks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16">
            <p
              className={`text-sm ${
                isDark ? "text-zinc-400" : "text-slate-500"
              }`}
            >
              {searchQuery ? "No links match your search" : "No links found"}
            </p>
          </div>
        ) : (
          <div className="p-2">
            {filteredLinks.map((link, index) => {
              const isSelected = selectedLinks.has(link);
              const displayPath = getDisplayPath(link);
              const linkNumber = links.indexOf(link) + 1;
              const isAnchor = anchorIndex === index;
              const inRange = isInPreviewRange(index);
              
              // Determine what the item will become if shift+clicked
              const willBeSelected = inRange && previewRange?.action === "select";
              const willBeDeselected = inRange && previewRange?.action === "deselect";

              return (
                <div
                  key={link}
                  onClick={(e) => handleLinkClick(link, index, e)}
                  onMouseEnter={() => setHoverIndex(index)}
                  onMouseLeave={() => setHoverIndex(null)}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer select-none transition-all duration-150 mb-1 ${
                    // Anchor indicator - subtle glow
                    isAnchor && isShiftHeld
                      ? isDark
                        ? "ring-2 ring-amber-500/60 ring-offset-1 ring-offset-zinc-900"
                        : "ring-2 ring-amber-400/60 ring-offset-1 ring-offset-slate-50"
                      : ""
                  } ${
                    // Preview range highlight
                    inRange && !isSelected && willBeSelected
                      ? isDark
                        ? "bg-emerald-500/30 border border-emerald-500/50"
                        : "bg-emerald-100 border border-emerald-300"
                      : inRange && isSelected && willBeDeselected
                      ? isDark
                        ? "bg-red-500/30 border border-red-500/50"
                        : "bg-red-100 border border-red-300"
                      : inRange
                      ? isDark
                        ? "bg-indigo-500/30 border border-indigo-500/50"
                        : "bg-indigo-100 border border-indigo-300"
                      : isSelected
                      ? isDark
                        ? "bg-indigo-500/20 border border-indigo-500/40"
                        : "bg-indigo-50 border border-indigo-200"
                      : isDark
                      ? "hover:bg-zinc-800 border border-transparent"
                      : "hover:bg-slate-100 border border-transparent"
                  }`}
                >
                  {/* Checkbox */}
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-all duration-150 ${
                      // Preview the future state
                      inRange && willBeSelected && !isSelected
                        ? isDark
                          ? "bg-emerald-500 text-white"
                          : "bg-emerald-500 text-white"
                        : inRange && willBeDeselected && isSelected
                        ? isDark
                          ? "bg-red-500/50 border border-red-400"
                          : "bg-red-200 border border-red-400"
                        : isSelected
                        ? isDark
                          ? "bg-indigo-500 text-white"
                          : "bg-indigo-500 text-white"
                        : isDark
                        ? "bg-zinc-700 border border-zinc-600 group-hover:border-indigo-500/50"
                        : "bg-white border border-slate-300 group-hover:border-indigo-400"
                    }`}
                  >
                    {/* Show check for selected items, or preview check for items that will be selected */}
                    {(isSelected && !(inRange && willBeDeselected)) || (inRange && willBeSelected && !isSelected) ? (
                      <svg
                        className={`w-3 h-3 ${inRange && willBeSelected && !isSelected ? "animate-pulse" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : inRange && willBeDeselected ? (
                      <svg
                        className="w-3 h-3 animate-pulse"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    ) : null}
                  </div>

                  {/* Link number */}
                  <span
                    className={`w-8 text-center text-xs font-mono shrink-0 transition-colors ${
                      isAnchor && isShiftHeld
                        ? isDark
                          ? "text-amber-400 font-bold"
                          : "text-amber-600 font-bold"
                        : inRange && willBeSelected
                        ? isDark
                          ? "text-emerald-400"
                          : "text-emerald-600"
                        : inRange && willBeDeselected
                        ? isDark
                          ? "text-red-400"
                          : "text-red-600"
                        : isSelected
                        ? isDark
                          ? "text-indigo-400"
                          : "text-indigo-600"
                        : isDark
                        ? "text-zinc-500"
                        : "text-slate-400"
                    }`}
                  >
                    {isAnchor && isShiftHeld ? "⚓" : `#${linkNumber}`}
                  </span>

                  {/* Link path */}
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm truncate transition-colors ${
                        inRange
                          ? isDark
                            ? "text-white"
                            : "text-slate-800"
                          : isSelected
                          ? isDark
                            ? "text-white"
                            : "text-slate-800"
                          : isDark
                          ? "text-zinc-400"
                          : "text-slate-600"
                      }`}
                    >
                      {displayPath}
                    </div>
                  </div>

                  {/* Status indicator */}
                  {inRange && willBeSelected && !isSelected ? (
                    <span
                      className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded animate-pulse ${
                        isDark
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-emerald-100 text-emerald-600"
                      }`}
                    >
                      + Select
                    </span>
                  ) : inRange && willBeDeselected && isSelected ? (
                    <span
                      className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded animate-pulse ${
                        isDark
                          ? "bg-red-500/20 text-red-400"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      − Remove
                    </span>
                  ) : !isSelected ? (
                    <span
                      className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded ${
                        isDark
                          ? "bg-red-500/10 text-red-400"
                          : "bg-red-50 text-red-500"
                      }`}
                    >
                      Excluded
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer with actions */}
      <div
        className={`px-4 py-3 border-t flex items-center justify-between ${
          isDark
            ? "bg-zinc-800/95 border-zinc-700"
            : "bg-white/95 border-slate-200"
        }`}
      >
        <p
          className={`text-xs ${isDark ? "text-zinc-500" : "text-slate-500"}`}
        >
          Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300 text-[10px]">⌘</kbd>+<kbd className="px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300 text-[10px]">Enter</kbd> to confirm
        </p>

        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isDark
                ? "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                : "bg-slate-200 text-slate-600 hover:bg-slate-300"
            }`}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={selectedCount === 0}
            className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isDark
                ? "bg-indigo-500 text-white hover:bg-indigo-400"
                : "bg-indigo-500 text-white hover:bg-indigo-600"
            }`}
          >
            Start Crawl ({selectedCount} links)
          </button>
        </div>
      </div>
    </div>
  );
}
