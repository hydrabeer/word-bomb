// src/hooks/useAutoScroll.ts
import { useLayoutEffect, useRef, useState } from "react";

export function useAutoScroll<T extends HTMLElement>(dependencies: any[]) {
  const containerRef = useRef<T>(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  // Monitor scroll position and update auto-scroll flag.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      // Enable auto-scroll if user is near bottom; disable otherwise.
      setAutoScrollEnabled(distanceFromBottom < 50);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Whenever the dependencies change (e.g. messages update), auto-scroll if enabled.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !autoScrollEnabled) return;
    // Use requestAnimationFrame to ensure DOM updates have occurred.
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, dependencies);

  return containerRef;
}
