import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useInviteLink } from './useInviteLink';

describe('useInviteLink', () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    Object.assign(navigator, { clipboard: originalClipboard });
  });

  it('copies text to clipboard and resets state after delay', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const { result } = renderHook(() => useInviteLink());

    await act(async () => {
      await result.current.copyInvite('https://example.com');
    });

    expect(writeText).toHaveBeenCalledWith('https://example.com');
    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.copied).toBe(false);
  });

  it('still toggles state even when clipboard APIs are unavailable', async () => {
    Object.assign(navigator, { clipboard: undefined });

    const { result } = renderHook(() => useInviteLink({ resetDelayMs: 100 }));

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.copyInvite('noop');
    });

    expect(success).toBe(false);
    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.copied).toBe(false);
  });
});
