import { useEffect } from 'react';

/**
 * Keeps the document title synced with the provided string.
 * Pass `undefined`/`null` to leave the current title untouched.
 */
export function useDocumentTitle(title?: string | null) {
  useEffect(() => {
    if (typeof title !== 'string') return;
    document.title = title;
  }, [title]);
}
