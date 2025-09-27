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
interface MockedSocket {
  on: (e: string, cb: (p: unknown) => void) => void;
  off: (e: string, cb: (p: unknown) => void) => void;
  emit: (e: string, payload: unknown, ack?: (res: unknown) => void) => void;
}

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
    let res: { success: boolean } | undefined;
    await act(async () => {
      res = await result.current.updateRules(result.current.rules);
    });
    expect(res?.success).toBe(false);
    expect(result.current.error).toBeTruthy();
  });

  it('updates successfully and clears error/isUpdating flags', async () => {
    const s = (socketModule as unknown as { socket: MockedSocket }).socket;
    const emitSpy = vi
      .spyOn(s, 'emit')
      .mockImplementation((_, __, ack?: (res: unknown) => void) => {
        ack?.({ success: true });
      });

    const { result } = renderHook(() => useRoomRules('ROOM'));
    // Initially no server rules
    expect(result.current.hasServerRules).toBe(false);
    // Perform successful update
    await act(async () => {
      const out = await result.current.updateRules(result.current.rules);
      expect(out.success).toBe(true);
    });
    expect(result.current.error).toBeNull();
    expect(result.current.isUpdating).toBe(false);

    emitSpy.mockRestore();
  });
});
