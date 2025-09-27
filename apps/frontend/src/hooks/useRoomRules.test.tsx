import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRoomRules } from './useRoomRules';

// Mock socket
vi.mock('../socket', () => {
  const handlers: Record<string, ((p: unknown) => void)[]> = {};
  return {
    socket: {
      on: (e: string, cb: (p: unknown) => void) => {
        (handlers[e] ||= []).push(cb);
      },
      off: (e: string, cb: (p: unknown) => void) => {
        handlers[e] = (handlers[e] || []).filter((h) => h !== cb);
      },
      emit: (_: string, __: unknown, ack?: (res: unknown) => void) => {
        ack?.({ success: false, error: 'No response from server.' });
      },
    },
    __emitServer: (e: string, p: unknown) =>
      (handlers[e] || []).forEach((h) => h(p)),
  };
});
import * as socketModule from '../socket';
const { __emitServer } = socketModule as unknown as {
  __emitServer: (e: string, p: unknown) => void;
};

describe('useRoomRules', () => {
  it('provides defaults and updates with server event; handles update error', async () => {
    const { result } = renderHook(() => useRoomRules('ABCD'));
    // Defaults present
    expect(result.current.rules.maxLives).toBe(3);
    // Server sends rules
    act(() => {
      __emitServer('roomRulesUpdated', {
        roomCode: 'ABCD',
        rules: {
          maxLives: 4,
          startingLives: 2,
          bonusTemplate: Array.from({ length: 26 }, () => 2),
          minTurnDuration: 6,
          minWordsPerPrompt: 200,
        },
      });
    });
    expect(result.current.rules.maxLives).toBe(4);

    // Attempt update and expect failure path to set error
    const res = await result.current.updateRules(result.current.rules);
    expect(res.success).toBe(false);
    // allow state update to flush
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current.error).toBeTruthy();
  });
});
