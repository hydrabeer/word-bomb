import { useLayoutEffect, useRef, useState, DependencyList } from 'react';

export function useAutoScroll<T extends HTMLElement>(
  dependencies: DependencyList,
) {
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

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Whenever dependencies change and if auto-scroll is enabled, scroll to bottom.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !autoScrollEnabled) return;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScrollEnabled, ...dependencies]);

  return containerRef;
}
