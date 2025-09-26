import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVisualState } from './useVisualState';

describe('useVisualState', () => {
  it('transitions idle -> seated -> playing', () => {
    let seated = 0;
    interface Player {
      id: string;
      name: string;
      isEliminated: boolean;
      lives: number;
    }
    let gs: {
      fragment: string;
      bombDuration: number;
      currentPlayerId: string | null;
      players: Player[];
    } | null = null;
    const { result, rerender } = renderHook(() =>
      useVisualState({ seatedCount: seated, gameState: gs }),
    );
    expect(result.current).toBe('idle');
    seated = 2;
    rerender();
    expect(result.current).toBe('seated');
    gs = {
      fragment: 'ab',
      bombDuration: 5,
      currentPlayerId: null,
      players: [],
    };
    rerender();
    expect(result.current).toBe('playing');
  });
});
