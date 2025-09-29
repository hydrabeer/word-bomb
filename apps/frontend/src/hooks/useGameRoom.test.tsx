import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameRoom } from './useGameRoom';

// Local mock for socket with connect state, on/off, and emit with ack support
vi.mock('../socket', () => {
  let connected = false;
  const handlers: Record<string, ((payload?: unknown) => void)[]> = {};
  const on = (event: string, cb: (payload?: unknown) => void) => {
    (handlers[event] ||= []).push(cb);
  };
  const off = (event: string, cb: (payload?: unknown) => void) => {
    handlers[event] = (handlers[event] || []).filter((h) => h !== cb);
  };
  const connect = () => {
    connected = true;
  };
  const emit = (
    event: string,
    payload?: unknown,
    ack?: (res: unknown) => void,
  ) => {
    // For tests, immediately call ack if provided
    if (typeof ack === 'function') ack({ success: false, error: 'oops' });
    // allow tests to assert emits
    __emitMock(event, payload);
  };
  const __emitServer = (event: string, payload?: unknown) => {
    (handlers[event] || []).forEach((h) => {
      h(payload);
    });
  };
  const __emitMock = vi.fn<(event: string, payload?: unknown) => void>();
  return {
    socket: {
      get connected() {
        return connected;
      },
      connect,
      on,
      off,
      emit,
    },
    __emitServer,
    __emitMock,
  };
});

// Stable player profile
vi.mock('../utils/playerProfile', () => ({
  getOrCreatePlayerProfile: () => ({ id: 'me', name: 'Me' }),
}));

import * as socketModule from '../socket';

describe('useGameRoom', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.useFakeTimers();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.clearAllTimers();
    logSpy.mockRestore();
  });

  it('connects and emits joinRoom after a tick', () => {
    const { __emitMock } = socketModule as unknown as {
      __emitMock: ReturnType<typeof vi.fn>;
    };

    const { unmount } = renderHook(
      ({ code }) => {
        useGameRoom(code);
      },
      {
        initialProps: { code: 'ABC' },
      },
    );

    // joinRoom is deferred with setTimeout 0
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(__emitMock).toHaveBeenCalledWith(
      'joinRoom',
      expect.objectContaining({ roomCode: 'ABC', playerId: 'me', name: 'Me' }),
    );

    // Unmount without rejoin should not emit leaveRoom due to latestRoomJoined === roomCode
    __emitMock.mockClear();
    unmount();
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(__emitMock).not.toHaveBeenCalledWith('leaveRoom', expect.anything());
  });

  it('emits leaveRoom when switching to a different room', () => {
    const { __emitMock } = socketModule as unknown as {
      __emitMock: ReturnType<typeof vi.fn>;
    };
    const { rerender } = renderHook(
      ({ code }) => {
        useGameRoom(code);
      },
      {
        initialProps: { code: 'ROOM1' },
      },
    );

    // allow first join
    act(() => {
      vi.advanceTimersByTime(1);
    });
    __emitMock.mockClear();

    // Rerender with a different room code -> cleanup schedules leave for ROOM1
    rerender({ code: 'ROOM2' });
    // new join
    act(() => {
      vi.advanceTimersByTime(1);
    });
    // allow leave timer (100ms)
    act(() => {
      vi.advanceTimersByTime(120);
    });

    // Expect a leave for the older room
    expect(__emitMock).toHaveBeenCalledWith(
      'leaveRoom',
      expect.objectContaining({ roomCode: 'ROOM1', playerId: 'me' }),
    );
  });
});
