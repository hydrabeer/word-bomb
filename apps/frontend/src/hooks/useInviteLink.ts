import { useCallback, useEffect, useRef, useState } from 'react';

interface UseInviteLinkOptions {
  resetDelayMs?: number;
}

interface UseInviteLinkResult {
  copied: boolean;
  copyInvite: (text: string) => Promise<boolean>;
}

/**
 * Small helper to centralize the clipboard copy flow + temporary "Copied" UI state.
 */
export function useInviteLink(
  options: UseInviteLinkOptions = {},
): UseInviteLinkResult {
  const { resetDelayMs = 2000 } = options;
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearResetTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const scheduleReset = useCallback(() => {
    clearResetTimeout();
    timeoutRef.current = setTimeout(() => {
      setCopied(false);
      timeoutRef.current = null;
    }, resetDelayMs);
  }, [clearResetTimeout, resetDelayMs]);

  const copyInvite = useCallback(
    async (text: string): Promise<boolean> => {
      setCopied(true);
      scheduleReset();
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        return false;
      }
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    },
    [scheduleReset],
  );

  useEffect(() => {
    return () => {
      clearResetTimeout();
    };
  }, [clearResetTimeout]);

  return { copied, copyInvite };
}
