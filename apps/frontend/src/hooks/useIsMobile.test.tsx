import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from './useIsMobile';

describe('useIsMobile', () => {
  it('responds to resize events', () => {
    // jsdom default width ~1024; set manually
    (window as unknown as { innerWidth: number }).innerWidth = 800;
    const { result } = renderHook(() => useIsMobile(900));
    expect(result.current).toBe(true);
    act(() => {
      (window as unknown as { innerWidth: number }).innerWidth = 1200;
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(false);
  });
});
