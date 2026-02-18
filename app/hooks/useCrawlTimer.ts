import { useState, useEffect, useRef } from "react";

export function useCrawlTimer(isActive: boolean): number {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isActive) {
      startTimeRef.current = Date.now();
      setElapsedSeconds(0);
    } else if (startTimeRef.current) {
      const seconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      setElapsedSeconds(seconds);
      startTimeRef.current = null;
    }
  }, [isActive]);

  return elapsedSeconds;
}
