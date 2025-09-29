import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlayerManagement } from './usePlayerManagement';

// Mock socket with on/off/emit and invoke acks
vi.mock('../socket', () => {
  const handlers: Record<string, ((payload?: unknown) => void)[]> = {};
  const on = (e: string, cb: (payload?: unknown) => void) => {
    (handlers[e] ||= []).push(cb);
  };
  const off = (e: string, cb: (payload?: unknown) => void) => {
    handlers[e] = handlers[e].filter((h) => h !== cb);
  };
  const emit = (
    e: string,
    payload?: unknown,
    ack?: (res: { success: boolean; error?: string }) => void,
  ) => {
    emitMock(e, payload, ack);
    if (ack) ack({ success: true });
  };
  const __emitServer = (e: string, payload?: unknown) => {
    handlers[e].forEach((h) => {
      h(payload);
    });
  };
  const emitMock = vi.fn();
  return { socket: { on, off, emit }, __emitServer, __emitMock: emitMock };
});

vi.mock('../utils/playerProfile', () => ({
  getOrCreatePlayerProfile: () => ({ id: 'me', name: 'Player Me' }),
}));

import * as socketModule from '../socket';

describe('usePlayerManagement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllTimers();
  });

  it('updates state on playersUpdated and playersDiff', () => {
    const { __emitServer, __emitMock } = socketModule as unknown as {
      __emitServer: (e: string, p?: unknown) => void;
      __emitMock: ReturnType<typeof vi.fn>;
    };

    const { result } = renderHook(() => usePlayerManagement('ROOM'));

    // playersUpdated full snapshot
    act(() => {
      __emitServer('playersUpdated', {
        players: [
          { id: 'a', name: 'Alice', isSeated: true },
          { id: 'me', name: 'Player Me', isSeated: false },
        ],
        leaderId: 'a',
      });
    });
    expect(result.current.players.length).toBe(2);
    expect(result.current.leaderId).toBe('a');
    expect(result.current.me?.id).toBe('me');

    // playersDiff remove, add, update, and leader change
    act(() => {
      __emitServer('playersDiff', {
        removed: ['a'],
        added: [{ id: 'b', name: 'Bob', isSeated: false }],
        updated: [{ id: 'me', changes: { isSeated: true } }],
        leaderIdChanged: null,
      });
    });
    expect(result.current.players.map((p) => p.id)).toEqual(['me', 'b']);
    expect(result.current.me?.isSeated).toBe(true);
    expect(result.current.leaderId).toBeNull();

    // actions
    act(() => {
      result.current.toggleSeated();
    });
    expect(__emitMock).toHaveBeenCalledWith(
      'setPlayerSeated',
      expect.objectContaining({
        roomCode: 'ROOM',
        playerId: 'me',
        seated: false,
      }),
      expect.any(Function),
    );

    act(() => {
      result.current.startGame();
    });
    expect(__emitMock).toHaveBeenCalledWith(
      'startGame',
      { roomCode: 'ROOM' },
      expect.any(Function),
    );
  });
});
