import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlayerStats } from './usePlayerStats';
import type {
  GameStartedParsed,
  TurnStartedParsed,
  WordAcceptedParsed,
} from '../socket/parsers';

type Handler = (payload: unknown) => void;

const socketState = vi.hoisted(() => {
  const handlers: Record<string, Handler[]> = {};
  const socketMock = {
    on: vi.fn((event: string, cb: Handler) => {
      (handlers[event] ||= []).push(cb);
    }),
    off: vi.fn((event: string, cb: Handler) => {
      handlers[event] = (handlers[event] ?? []).filter((h) => h !== cb);
    }),
    emit: vi.fn(),
  };
  return { handlers, socketMock };
});

const emitServer = (event: string, payload: unknown) => {
  (socketState.handlers[event] ?? []).forEach((cb) => cb(payload));
};

const parserMocks = vi.hoisted(() => {
  return {
    parseGameStartedMock:
      vi.fn<(payload: unknown) => GameStartedParsed | null>(),
    parseTurnStartedMock:
      vi.fn<(payload: unknown) => TurnStartedParsed | null>(),
    parseWordAcceptedMock:
      vi.fn<(payload: unknown) => WordAcceptedParsed | null>(),
  };
});

vi.mock('../socket', () => ({
  socket: socketState.socketMock,
}));

vi.mock('../socket/parsers', () => ({
  parseGameStarted: parserMocks.parseGameStartedMock,
  parseTurnStarted: parserMocks.parseTurnStartedMock,
  parseWordAccepted: parserMocks.parseWordAcceptedMock,
}));

describe('usePlayerStats', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    parserMocks.parseGameStartedMock.mockReset();
    parserMocks.parseTurnStartedMock.mockReset();
    parserMocks.parseWordAcceptedMock.mockReset();
    Object.keys(socketState.handlers).forEach((key) => {
      socketState.handlers[key] = [];
    });
    socketState.socketMock.on.mockClear();
    socketState.socketMock.off.mockClear();
    socketState.socketMock.emit.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tracks stats across accepted words', () => {
    const { result } = renderHook(() => usePlayerStats('ROOM', 'p1', 'Alice'));

    expect(result.current.stats).toMatchObject({
      username: 'Alice',
      totalWords: 0,
      longWords: 0,
      hyphenatedWords: 0,
      accuracyStreak: 0,
      averageReactionSeconds: null,
      averageWpm: null,
    });

    parserMocks.parseTurnStartedMock.mockReturnValue({
      playerId: 'p1',
      fragment: 'ab',
      bombDuration: 10,
      players: [],
    } satisfies TurnStartedParsed);

    act(() => {
      emitServer('turnStarted', { raw: true });
    });

    vi.advanceTimersByTime(1500);

    parserMocks.parseWordAcceptedMock.mockReturnValue({
      playerId: 'p1',
      word: 'supercalifragilisticexpialidocious-extra',
    } satisfies WordAcceptedParsed);

    act(() => {
      emitServer('wordAccepted', { raw: true });
    });

    expect(result.current.stats.totalWords).toBe(1);
    expect(result.current.stats.longWords).toBe(1);
    expect(result.current.stats.hyphenatedWords).toBe(1);
    expect(result.current.stats.accuracyStreak).toBe(1);
    expect(result.current.stats.averageReactionSeconds).toBeCloseTo(1.5, 2);
    expect(result.current.stats.averageWpm).toBeCloseTo(320, 0);

    parserMocks.parseTurnStartedMock.mockReturnValue({
      playerId: 'p2',
      fragment: 'cd',
      bombDuration: 10,
      players: [],
    } satisfies TurnStartedParsed);

    act(() => {
      emitServer('turnStarted', { raw: true });
    });

    vi.advanceTimersByTime(500);

    parserMocks.parseWordAcceptedMock.mockReturnValue({
      playerId: 'p1',
      word: 'quick-hyphen',
    } satisfies WordAcceptedParsed);

    act(() => {
      emitServer('wordAccepted', { raw: true });
    });

    expect(result.current.stats.totalWords).toBe(2);
    expect(result.current.stats.hyphenatedWords).toBe(2);
    expect(result.current.stats.longWords).toBe(1);
    expect(result.current.stats.averageReactionSeconds).toBeCloseTo(0.75, 2);
    expect(result.current.stats.averageWpm).toBeCloseTo(416, 0);

    act(() => {
      result.current.registerRejection();
    });

    expect(result.current.stats.accuracyStreak).toBe(0);
  });

  it('resets state on new game or room', () => {
    const { result, rerender } = renderHook(
      ({ roomCode, username }) => usePlayerStats(roomCode, 'p1', username),
      { initialProps: { roomCode: 'ROOM', username: 'Alice' } },
    );

    parserMocks.parseWordAcceptedMock.mockReturnValue({
      playerId: 'p1',
      word: 'word',
    } satisfies WordAcceptedParsed);

    act(() => {
      emitServer('wordAccepted', {});
    });

    expect(result.current.stats.totalWords).toBe(1);

    parserMocks.parseGameStartedMock.mockReturnValue({
      fragment: 'ab',
      bombDuration: 10,
      currentPlayer: 'p1',
      players: [],
    } satisfies GameStartedParsed);

    act(() => {
      emitServer('gameStarted', {});
    });

    expect(result.current.stats.totalWords).toBe(0);

    rerender({ roomCode: 'NEW', username: 'Alice' });
    expect(result.current.stats.totalWords).toBe(0);

    rerender({ roomCode: 'NEW', username: 'Bob' });
    expect(result.current.stats.username).toBe('Bob');
  });

  it('ignores malformed or other-player socket payloads', () => {
    const { result } = renderHook(() => usePlayerStats('ROOM', 'p1', 'Alice'));

    parserMocks.parseGameStartedMock.mockReturnValueOnce(null);
    act(() => {
      emitServer('gameStarted', { bogus: true });
    });

    parserMocks.parseTurnStartedMock.mockReturnValueOnce(null);
    act(() => {
      emitServer('turnStarted', { bogus: true });
    });

    parserMocks.parseWordAcceptedMock
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({
        playerId: 'other-player',
        word: 'hello',
      } satisfies WordAcceptedParsed);

    act(() => {
      emitServer('wordAccepted', {});
      emitServer('wordAccepted', {});
    });

    expect(result.current.stats.totalWords).toBe(0);
    expect(result.current.stats.accuracyStreak).toBe(0);
  });
});
