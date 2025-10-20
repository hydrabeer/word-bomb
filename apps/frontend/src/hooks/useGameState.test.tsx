import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameState } from './useGameState';

// Test-local typed mock socket
interface MockSocket {
  on: (event: string, cb: (payload?: unknown) => void) => void;
  off: (event: string, cb: (payload?: unknown) => void) => void;
  emit: (event: string, payload?: unknown) => void;
}

vi.mock('../socket', () => {
  const handlers: Record<string, ((payload?: unknown) => void)[]> = {};
  const emitMock = vi.fn<(event: string, payload?: unknown) => void>();
  const on: MockSocket['on'] = (e, cb) => {
    (handlers[e] ||= []).push(cb);
  };
  const off: MockSocket['off'] = (e, cb) => {
    handlers[e] = handlers[e].filter((h) => h !== cb);
  };
  const emit: MockSocket['emit'] = (e, p) => {
    emitMock(e, p);
  };
  const __emitServer = (e: string, p?: unknown) => {
    handlers[e].forEach((h) => {
      h(p);
    });
  };
  const socket: MockSocket = { on, off, emit };
  return { socket, __emitServer, __emitMock: emitMock };
});
import * as socketModule from '../socket';
const __emitServer = (
  socketModule as unknown as { __emitServer: (e: string, p?: unknown) => void }
).__emitServer;

function advance(ms: number) {
  vi.advanceTimersByTime(ms);
}

describe('useGameState hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllTimers();
  });

  it('handles game lifecycle events and timers', () => {
    const { result } = renderHook(() => useGameState('ROOM'));

    act(() => {
      __emitServer('gameCountdownStarted', { deadline: Date.now() + 1500 });
    });
    act(() => {
      advance(300);
    }); // allow interval tick
    expect(result.current.timeLeftSec).toBeGreaterThanOrEqual(1);

    act(() => {
      __emitServer('gameStarted', {
        fragment: 'ab',
        bombDuration: 2,
        currentPlayer: 'p1',
        players: [],
      });
    });
    expect(result.current.gameState?.fragment).toBe('ab');

    act(() => {
      __emitServer('turnStarted', {
        fragment: 'c',
        bombDuration: 1,
        playerId: 'p1',
        players: [],
      });
    });
    expect(result.current.gameState?.currentPlayerId).toBe('p1');

    act(() => {
      __emitServer('playerTypingUpdate', { playerId: 'p1', input: 'car' });
    });
    expect(result.current.liveInputs.p1).toBe('car');

    act(() => {
      __emitServer('wordAccepted', { playerId: 'p1', word: 'car' });
    });
    expect(result.current.lastSubmittedWords.p1.word).toBe('car');

    act(() => {
      advance(2000);
    });
    expect(result.current.bombCountdown).toBeGreaterThanOrEqual(0);

    act(() => {
      __emitServer('gameEnded', { winnerId: 'p1' });
    });
    expect(result.current.gameState).toBeNull();
    expect(result.current.winnerId).toBe('p1');
  });

  it('stops countdown, tracks player updates, and emits typing events', () => {
    const { __emitServer, __emitMock } = socketModule as unknown as {
      __emitServer: (e: string, p?: unknown) => void;
      __emitMock: ReturnType<typeof vi.fn>;
    };
    vi.setSystemTime(1_000);
    const { result } = renderHook(() => useGameState('ROOM'));

    act(() => {
      __emitServer('gameCountdownStarted', { deadline: Date.now() + 500 });
    });
    expect(result.current.countdownDeadline).not.toBeNull();

    act(() => {
      __emitServer('gameCountdownStopped');
    });
    expect(result.current.countdownDeadline).toBeNull();
    expect(result.current.timeLeftSec).toBe(0);

    act(() => {
      __emitServer('gameStarted', {
        fragment: 'go',
        bombDuration: 2,
        currentPlayer: 'p1',
        players: [
          {
            id: 'p1',
            name: 'Player One',
            lives: 2,
            isEliminated: false,
            isConnected: true,
          },
        ],
      });
    });

    act(() => {
      __emitServer('playerUpdated', { playerId: 'p1', lives: 0 });
    });
    expect(result.current.gameState?.players[0].isEliminated).toBe(true);

    act(() => {
      result.current.updateLiveInput('p1', 'typing');
    });
    expect(__emitMock).toHaveBeenCalledWith(
      'playerTyping',
      expect.objectContaining({ roomCode: 'ROOM', playerId: 'p1', input: 'typing' }),
    );

    act(() => {
      __emitServer('wordAccepted', { playerId: 'p1', word: ' hey ' });
    });
    expect(result.current.lastSubmittedWords.p1.word).toBe('hey');
    expect(result.current.lastWordAcceptedBy).toBe('p1');

    act(() => {
      advance(500);
    });
    expect(result.current.lastWordAcceptedBy).toBeNull();
  });
});
