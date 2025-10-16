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

  it('tracks stats across accepted words for all players', () => {
    const { result } = renderHook(() => usePlayerStats('ROOM', 'p1', 'Alice'));

    const statsFor = (id: string) =>
      result.current.stats.find((entry) => entry.playerId === id);

    expect(statsFor('p1')).toMatchObject({
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
      players: [
        {
          id: 'p1',
          name: 'Alice',
          isEliminated: false,
          lives: 3,
          isConnected: true,
        },
        {
          id: 'p2',
          name: 'Bob',
          isEliminated: false,
          lives: 3,
          isConnected: true,
        },
      ],
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

    expect(statsFor('p1')?.totalWords).toBe(1);
    expect(statsFor('p1')?.longWords).toBe(1);
    expect(statsFor('p1')?.hyphenatedWords).toBe(1);
    expect(statsFor('p1')?.accuracyStreak).toBe(1);
    expect(statsFor('p1')?.averageReactionSeconds).toBeCloseTo(1.5, 2);
    expect(statsFor('p1')?.averageWpm).toBeCloseTo(320, 0);

    parserMocks.parseTurnStartedMock.mockReturnValue({
      playerId: 'p2',
      fragment: 'cd',
      bombDuration: 10,
      players: [
        {
          id: 'p1',
          name: 'Alice',
          isEliminated: false,
          lives: 3,
          isConnected: true,
        },
        {
          id: 'p2',
          name: 'Bob',
          isEliminated: false,
          lives: 3,
          isConnected: true,
        },
      ],
    } satisfies TurnStartedParsed);

    act(() => {
      emitServer('turnStarted', { raw: true });
    });

    vi.advanceTimersByTime(800);

    parserMocks.parseWordAcceptedMock.mockReturnValue({
      playerId: 'p2',
      word: 'steadfast',
    } satisfies WordAcceptedParsed);

    act(() => {
      emitServer('wordAccepted', { raw: true });
    });

    expect(statsFor('p2')).toMatchObject({
      username: 'Bob',
      totalWords: 1,
      longWords: 0,
      hyphenatedWords: 0,
      accuracyStreak: 1,
    });
    expect(statsFor('p2')?.averageReactionSeconds).toBeCloseTo(0.8, 1);

    vi.advanceTimersByTime(500);

    parserMocks.parseWordAcceptedMock.mockReturnValue({
      playerId: 'p1',
      word: 'quick-hyphen',
    } satisfies WordAcceptedParsed);

    act(() => {
      emitServer('wordAccepted', { raw: true });
    });

    expect(statsFor('p1')?.totalWords).toBe(2);
    expect(statsFor('p1')?.hyphenatedWords).toBe(2);
    expect(statsFor('p1')?.longWords).toBe(1);
    expect(statsFor('p1')?.averageReactionSeconds).toBeCloseTo(0.75, 2);
    expect(statsFor('p1')?.averageWpm).toBeCloseTo(416, 0);

    act(() => {
      result.current.registerRejection();
    });

    expect(statsFor('p1')?.accuracyStreak).toBe(0);
    expect(statsFor('p2')?.accuracyStreak).toBe(1);
  });

  it('resets state on new game or room', () => {
    const { result, rerender } = renderHook(
      ({ roomCode, username }) => usePlayerStats(roomCode, 'p1', username),
      { initialProps: { roomCode: 'ROOM', username: 'Alice' } },
    );

    const statsFor = (id: string) =>
      result.current.stats.find((entry) => entry.playerId === id);

    parserMocks.parseWordAcceptedMock.mockReturnValue({
      playerId: 'p1',
      word: 'word',
    } satisfies WordAcceptedParsed);

    act(() => {
      emitServer('wordAccepted', {});
    });

    expect(statsFor('p1')?.totalWords).toBe(1);

    parserMocks.parseGameStartedMock.mockReturnValue({
      fragment: 'ab',
      bombDuration: 10,
      currentPlayer: 'p1',
      players: [],
    } satisfies GameStartedParsed);

    act(() => {
      emitServer('gameStarted', {});
    });

    expect(statsFor('p1')?.totalWords).toBe(0);

    rerender({ roomCode: 'NEW', username: 'Alice' });
    expect(statsFor('p1')?.totalWords).toBe(0);

    rerender({ roomCode: 'NEW', username: 'Bob' });
    expect(statsFor('p1')?.username).toBe('Bob');
  });

  it('defaults the local player username when blank', () => {
    const { result } = renderHook(() => usePlayerStats('ROOM', 'p1', '   '));

    const statsFor = (id: string) =>
      result.current.stats.find((entry) => entry.playerId === id);

    expect(statsFor('p1')?.username).toBe('Unknown');
  });

  it('ignores username updates when player id is not set', () => {
    const { result, rerender } = renderHook(
      ({ playerId, username }) => usePlayerStats('ROOM', playerId, username),
      { initialProps: { playerId: 'p1', username: 'Alice' } },
    );

    rerender({ playerId: '', username: 'Alice' });
    rerender({ playerId: '', username: 'Bob' });

    expect(
      result.current.stats.find((entry) => entry.playerId === 'p1'),
    ).toBeUndefined();
  });

  it('sanitizes username when updated to blank text', () => {
    const { result, rerender } = renderHook(
      ({ username }) => usePlayerStats('ROOM', 'p1', username),
      { initialProps: { username: 'Alice' } },
    );

    const statsFor = (id: string) =>
      result.current.stats.find((entry) => entry.playerId === id);

    expect(statsFor('p1')?.username).toBe('Alice');

    rerender({ username: '   ' });

    expect(statsFor('p1')?.username).toBe('Unknown');
  });

  it('resets tracked stats when the local player id changes', () => {
    const { result, rerender } = renderHook(
      ({ playerId }) => usePlayerStats('ROOM', playerId, 'Alice'),
      { initialProps: { playerId: 'p1' } },
    );

    const statsFor = (id: string) =>
      result.current.stats.find((entry) => entry.playerId === id);

    parserMocks.parseWordAcceptedMock.mockReturnValue({
      playerId: 'p1',
      word: 'word',
    } satisfies WordAcceptedParsed);

    act(() => {
      emitServer('wordAccepted', {});
    });

    expect(statsFor('p1')?.totalWords).toBe(1);

    rerender({ playerId: 'p2' });

    expect(statsFor('p1')).toBeUndefined();
    expect(statsFor('p2')).toMatchObject({
      username: 'Alice',
      totalWords: 0,
    });
  });

  it('registers rejection only when player context is available', () => {
    const { result, rerender } = renderHook(
      ({ playerId }) => usePlayerStats('ROOM', playerId, 'Alice'),
      { initialProps: { playerId: 'p1' } },
    );

    const statsFor = (id: string) =>
      result.current.stats.find((entry) => entry.playerId === id);

    act(() => {
      result.current.registerRejection();
    });

    rerender({ playerId: '' });

    act(() => {
      result.current.registerRejection();
    });

    rerender({ playerId: 'p1' });

    parserMocks.parseWordAcceptedMock.mockReturnValue({
      playerId: 'p1',
      word: 'word',
    } satisfies WordAcceptedParsed);

    act(() => {
      emitServer('wordAccepted', {});
    });

    expect(statsFor('p1')?.accuracyStreak).toBe(1);

    act(() => {
      result.current.registerRejection();
    });

    expect(statsFor('p1')?.accuracyStreak).toBe(0);
  });

  it('ignores malformed payloads but records valid stats', () => {
    const { result } = renderHook(() => usePlayerStats('ROOM', 'p1', 'Alice'));

    const statsFor = (id: string) =>
      result.current.stats.find((entry) => entry.playerId === id);

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

    expect(statsFor('p1')?.totalWords ?? 0).toBe(0);
    expect(statsFor('p1')?.accuracyStreak ?? 0).toBe(0);
    expect(statsFor('other-player')).toMatchObject({
      username: 'Unknown',
      totalWords: 1,
      hyphenatedWords: 0,
      longWords: 0,
    });
  });

  it('orders players by latest roster and alphabetizes fallbacks', () => {
    const { result } = renderHook(() => usePlayerStats('ROOM', 'p1', 'Alpha'));

    const playerIds = () => result.current.stats.map((entry) => entry.playerId);

    parserMocks.parseGameStartedMock.mockReturnValue({
      fragment: 'ab',
      bombDuration: 10,
      currentPlayer: 'p1',
      players: [
        {
          id: 'p1',
          name: 'Alpha',
          lives: 3,
          isEliminated: false,
          isConnected: true,
        },
        {
          id: 'p2',
          name: 'Zeke',
          lives: 3,
          isEliminated: false,
          isConnected: true,
        },
        {
          id: 'p3',
          name: 'Beta',
          lives: 3,
          isEliminated: false,
          isConnected: true,
        },
      ],
    } satisfies GameStartedParsed);

    act(() => {
      emitServer('gameStarted', {});
    });

    expect(playerIds()).toEqual(['p1', 'p2', 'p3']);

    parserMocks.parseTurnStartedMock.mockReturnValue({
      playerId: 'p2',
      fragment: 'cd',
      bombDuration: 10,
      players: [
        {
          id: 'p2',
          name: 'Zeke',
          lives: 3,
          isEliminated: false,
          isConnected: true,
        },
      ],
    } satisfies TurnStartedParsed);

    act(() => {
      emitServer('turnStarted', {});
    });

    expect(playerIds()).toEqual(['p2', 'p1', 'p3']);

    parserMocks.parseTurnStartedMock.mockReturnValue({
      playerId: 'p3',
      fragment: 'ef',
      bombDuration: 10,
      players: [
        {
          id: 'p2',
          name: 'Zeke',
          lives: 3,
          isEliminated: false,
          isConnected: true,
        },
        {
          id: 'p3',
          name: 'Charlie',
          lives: 3,
          isEliminated: false,
          isConnected: true,
        },
      ],
    } satisfies TurnStartedParsed);

    act(() => {
      emitServer('turnStarted', {});
    });

    expect(playerIds()).toEqual(['p2', 'p3', 'p1']);
    expect(
      result.current.stats.find((entry) => entry.playerId === 'p3')?.username,
    ).toBe('Charlie');
  });

  it('handles rosterless turns and ignores blank accepted words', () => {
    const { result } = renderHook(() => usePlayerStats('ROOM', 'p1', 'Alice'));

    const statsFor = (id: string) =>
      result.current.stats.find((entry) => entry.playerId === id);

    parserMocks.parseTurnStartedMock.mockReturnValue({
      playerId: 'p1',
      fragment: 'ab',
      bombDuration: 10,
      players: [
        {
          id: 'p1',
          name: 'Alice',
          lives: 3,
          isEliminated: false,
          isConnected: true,
        },
      ],
    } satisfies TurnStartedParsed);

    act(() => {
      emitServer('turnStarted', {});
    });

    vi.advanceTimersByTime(700);

    parserMocks.parseWordAcceptedMock.mockReturnValue({
      playerId: 'p1',
      word: '   ',
    } satisfies WordAcceptedParsed);

    act(() => {
      emitServer('wordAccepted', {});
    });

    expect(statsFor('p1')?.totalWords).toBe(0);
    expect(statsFor('p1')?.accuracyStreak).toBe(0);

    parserMocks.parseTurnStartedMock.mockReturnValue({
      playerId: 'p2',
      fragment: 'cd',
      bombDuration: 10,
      players: [],
    } satisfies TurnStartedParsed);

    act(() => {
      emitServer('turnStarted', {});
    });

    vi.advanceTimersByTime(600);

    parserMocks.parseWordAcceptedMock.mockReturnValueOnce({
      playerId: 'p2',
      word: 'rocket',
    } satisfies WordAcceptedParsed);

    act(() => {
      emitServer('wordAccepted', {});
    });

    expect(statsFor('p2')).toMatchObject({
      username: 'Unknown',
      totalWords: 1,
      accuracyStreak: 1,
    });
    expect(statsFor('p2')?.averageReactionSeconds).toBeCloseTo(0.6, 1);

    parserMocks.parseWordAcceptedMock.mockReturnValue({
      playerId: 'p1',
      word: 'word',
    } satisfies WordAcceptedParsed);

    act(() => {
      emitServer('wordAccepted', {});
    });

    expect(statsFor('p1')?.totalWords).toBe(1);
    expect(statsFor('p1')?.averageReactionSeconds).toBeNull();
  });

  it('resets roster from game start payload and updates names when provided', () => {
    const { result } = renderHook(() => usePlayerStats('ROOM', 'pA', 'Hero'));

    const statsFor = (id: string) =>
      result.current.stats.find((entry) => entry.playerId === id);

    parserMocks.parseGameStartedMock.mockReturnValue({
      fragment: 'xy',
      bombDuration: 10,
      currentPlayer: 'pB',
      players: [
        {
          id: 'pB',
          name: '',
          lives: 3,
          isEliminated: false,
          isConnected: true,
        },
        {
          id: 'pC',
          name: 'Nova',
          lives: 3,
          isEliminated: false,
          isConnected: true,
        },
      ],
    } satisfies GameStartedParsed);

    act(() => {
      emitServer('gameStarted', {});
    });

    expect(statsFor('pA')?.username).toBe('Hero');
    expect(statsFor('pB')?.username).toBe('Unknown');
    expect(statsFor('pC')?.username).toBe('Nova');

    parserMocks.parseTurnStartedMock.mockReturnValue({
      playerId: 'pB',
      fragment: 'zz',
      bombDuration: 10,
      players: [
        {
          id: 'pB',
          name: 'Phoenix',
          lives: 3,
          isEliminated: false,
          isConnected: true,
        },
      ],
    } satisfies TurnStartedParsed);

    act(() => {
      emitServer('turnStarted', {});
    });

    expect(statsFor('pB')?.username).toBe('Phoenix');
  });
});
