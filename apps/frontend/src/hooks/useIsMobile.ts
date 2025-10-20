import { useEffect, useState } from 'react';

type WindowLike = Pick<
  Window,
  'innerWidth' | 'addEventListener' | 'removeEventListener'
>;

/** Responsive breakpoint detection (SSR-safe). Default breakpoint = 768px. */
export function useIsMobile(
  breakpoint = 768,
  targetWindow: WindowLike | null =
    typeof window === 'undefined' ? null : window,
) {
  const resolvedWindow =
    targetWindow ?? (typeof window === 'undefined' ? null : window);

  const [isMobile, setIsMobile] = useState(() =>
    resolvedWindow ? resolvedWindow.innerWidth < breakpoint : false,
  );

  useEffect(() => {
    const activeWindow =
      targetWindow ?? (typeof window === 'undefined' ? null : window);
    if (!activeWindow) {
      return;
    }
    if (
      typeof activeWindow.addEventListener !== 'function' ||
      typeof activeWindow.removeEventListener !== 'function'
    ) {
      return;
    }
    const handler = () => {
      setIsMobile(activeWindow.innerWidth < breakpoint);
    };
    activeWindow.addEventListener('resize', handler);
    return () => {
      activeWindow.removeEventListener('resize', handler);
    };
  }, [breakpoint, targetWindow]);

  return isMobile;
}
