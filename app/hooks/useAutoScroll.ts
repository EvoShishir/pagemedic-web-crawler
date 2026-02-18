import { useRef, useEffect, useCallback } from "react";

export function useAutoScroll(dependencies: unknown[]) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const isProgrammaticRef = useRef(false);

  useEffect(() => {
    if (shouldAutoScrollRef.current && containerRef.current) {
      isProgrammaticRef.current = true;
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      requestAnimationFrame(() => {
        isProgrammaticRef.current = false;
      });
    }
  }, [...dependencies]);

  const handleScroll = useCallback(() => {
    if (isProgrammaticRef.current) return;
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    shouldAutoScrollRef.current = isAtBottom;
  }, []);

  const resetAutoScroll = useCallback(() => {
    shouldAutoScrollRef.current = true;
    if (containerRef.current) {
      isProgrammaticRef.current = true;
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      requestAnimationFrame(() => {
        isProgrammaticRef.current = false;
      });
    }
  }, []);

  return {
    containerRef,
    handleScroll,
    resetAutoScroll,
  };
}
