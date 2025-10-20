import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBonusAlphabetSettings } from './useBonusAlphabetSettings';

const STORAGE_KEY = 'wordbomb:bonusAlphabetSettings:v1';

describe('useBonusAlphabetSettings', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('loads defaults when storage empty', () => {
    const { result } = renderHook(() => useBonusAlphabetSettings());
    expect(result.current.settings).toMatchObject({
      size: 'md',
      position: 'top-right',
      showNumbers: true,
      layout: 'stacked',
    });
  });

  it('loads values from localStorage when valid', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        size: 'sm',
        position: 'bottom-left',
        opacity: 0.5,
        showNumbers: false,
      }),
    );
    const { result } = renderHook(() => useBonusAlphabetSettings());
    expect(result.current.settings).toEqual({
      size: 'sm',
      position: 'bottom-left',
      opacity: 0.5,
      showNumbers: false,
      layout: 'stacked',
    });
  });

  it('updates and persists to localStorage', () => {
    const setItemSpy = vi.spyOn(window.localStorage.__proto__, 'setItem');
    const { result } = renderHook(() => useBonusAlphabetSettings());
    act(() => {
      result.current.setSettings({ opacity: 0.3 });
    });
    expect(result.current.settings.opacity).toBe(0.3);
    expect(setItemSpy).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.stringContaining('"opacity":0.3'),
    );
  });

  it('ignores invalid JSON in storage gracefully', () => {
    localStorage.setItem(STORAGE_KEY, '{not-json');
    const { result } = renderHook(() => useBonusAlphabetSettings());
    expect(result.current.settings).toHaveProperty('size');
  });

  it('swallows storage write errors without breaking state', () => {
    const setItemSpy = vi
      .spyOn(window.localStorage.__proto__, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota');
      });
    const { result } = renderHook(() => useBonusAlphabetSettings());
    act(() => {
      result.current.setSettings({ showNumbers: false });
    });
    expect(result.current.settings.showNumbers).toBe(false);
    expect(setItemSpy).toHaveBeenCalled();
    setItemSpy.mockRestore();
  });

  it('reset returns to defaults', () => {
    const { result } = renderHook(() => useBonusAlphabetSettings());
    act(() => {
      result.current.setSettings({ size: 'sm' });
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.settings.size).toBe('md');
  });
});
