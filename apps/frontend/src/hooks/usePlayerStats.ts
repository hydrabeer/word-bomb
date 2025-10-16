// apps/frontend/src/hooks/usePlayerStats.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { socket } from '../socket';
import {
  type PlayerEntryParsed,
  parseGameStarted,
  parseTurnStarted,
  parseWordAccepted,
} from '../socket/parsers';

export interface PlayerStatsSnapshot {
  playerId: string;
  username: string;
  totalWords: number;
  averageWpm: number | null;
  averageReactionSeconds: number | null;
  longWords: number;
  accuracyStreak: number;
  hyphenatedWords: number;
}

interface MutablePlayerStats {
  username: string;
  totalWords: number;
  totalChars: number;
  totalReactionMs: number;
  longWords: number;
  accuracyStreak: number;
  hyphenatedWords: number;
  lastTurnStart: number | null;
}

const UNKNOWN_PLAYER_NAME = 'Unknown';

const createMutableStats = (username: string): MutablePlayerStats => ({
  username,
  totalWords: 0,
  totalChars: 0,
  totalReactionMs: 0,
  longWords: 0,
  accuracyStreak: 0,
  hyphenatedWords: 0,
  lastTurnStart: null,
});

const resetMutableStats = (target: MutablePlayerStats, username?: string) => {
  if (username && username.trim()) {
    target.username = username;
  }
  target.totalWords = 0;
  target.totalChars = 0;
  target.totalReactionMs = 0;
  target.longWords = 0;
  target.accuracyStreak = 0;
  target.hyphenatedWords = 0;
  target.lastTurnStart = null;
};

const toSnapshot = (
  playerId: string,
  stats: MutablePlayerStats,
): PlayerStatsSnapshot => {
  const { totalWords, totalChars, totalReactionMs } = stats;
  const averageReactionSeconds =
    totalWords > 0 && totalReactionMs > 0
      ? totalReactionMs / totalWords / 1000
      : null;
  const averageWpm =
    totalReactionMs > 0 && totalChars > 0
      ? (totalChars * 60000) / (5 * Math.max(totalReactionMs, 1))
      : null;

  return {
    playerId,
    username: stats.username,
    totalWords,
    averageWpm,
    averageReactionSeconds,
    longWords: stats.longWords,
    accuracyStreak: stats.accuracyStreak,
    hyphenatedWords: stats.hyphenatedWords,
  };
};

/**
 * Tracks per-user gameplay stats derived from socket events so the UI can render
 * lightweight dashboards without touching the core game engine.
 */
export function usePlayerStats(
  roomCode: string,
  playerId: string,
  username: string,
) {
  const usernameRef = useRef(username);
  const playerIdRef = useRef(playerId);
  const statsRef = useRef<Map<string, MutablePlayerStats>>(new Map());
  const playerOrderRef = useRef<string[]>([]);

  const [stats, setStats] = useState<PlayerStatsSnapshot[]>([]);

  const updateSnapshots = useCallback(() => {
    const orderIndex = new Map<string, number>();
    playerOrderRef.current.forEach((id, idx) => {
      orderIndex.set(id, idx);
    });

    const snapshots = Array.from(statsRef.current.entries()).map(([id, data]) =>
      toSnapshot(id, data),
    );

    snapshots.sort((a, b) => {
      const indexA = orderIndex.get(a.playerId) ?? Number.MAX_SAFE_INTEGER;
      const indexB = orderIndex.get(b.playerId) ?? Number.MAX_SAFE_INTEGER;
      if (indexA !== indexB) return indexA - indexB;
      return a.username.localeCompare(b.username);
    });

    setStats(snapshots);
  }, []);

  const ensurePlayer = useCallback(
    (id: string, name?: string): MutablePlayerStats => {
      const nextName = name && name.trim() ? name : UNKNOWN_PLAYER_NAME;
      let record = statsRef.current.get(id);
      if (!record) {
        record = createMutableStats(nextName);
        statsRef.current.set(id, record);
        if (!playerOrderRef.current.includes(id)) {
          playerOrderRef.current = [...playerOrderRef.current, id];
        }
      } else if (name && name.trim() && record.username !== name) {
        record.username = name;
      }
      return record;
    },
    [],
  );

  const resetAll = useCallback(
    (players?: PlayerEntryParsed[]) => {
      statsRef.current = new Map();
      playerOrderRef.current = [];

      if (players && players.length > 0) {
        for (const entry of players) {
          playerOrderRef.current.push(entry.id);
          statsRef.current.set(
            entry.id,
            createMutableStats(
              entry.name?.trim() ? entry.name : UNKNOWN_PLAYER_NAME,
            ),
          );
        }
      }

      const activePlayerId = playerIdRef.current;
      const activeUsername = usernameRef.current;

      if (activePlayerId) {
        const existing = statsRef.current.get(activePlayerId);
        if (existing) {
          resetMutableStats(existing, activeUsername);
        } else {
          playerOrderRef.current.push(activePlayerId);
          statsRef.current.set(
            activePlayerId,
            createMutableStats(
              activeUsername && activeUsername.trim()
                ? activeUsername
                : UNKNOWN_PLAYER_NAME,
            ),
          );
        }
      }

      for (const [, record] of statsRef.current) {
        resetMutableStats(record);
      }

      updateSnapshots();
    },
    [updateSnapshots],
  );

  useEffect(() => {
    if (usernameRef.current === username) return;
    usernameRef.current = username;
    const activeId = playerIdRef.current;
    if (!activeId) return;
    const record = statsRef.current.get(activeId);
    if (record) {
      record.username =
        username && username.trim() ? username : UNKNOWN_PLAYER_NAME;
      updateSnapshots();
    }
  }, [username, updateSnapshots]);

  useEffect(() => {
    if (playerIdRef.current !== playerId) {
      playerIdRef.current = playerId;
      resetAll();
    }
  }, [playerId, resetAll]);

  useEffect(() => {
    resetAll();
  }, [roomCode, resetAll]);

  useEffect(() => {
    const handleGameStarted = (raw: unknown) => {
      const parsed = parseGameStarted(raw);
      if (!parsed) return;
      resetAll(parsed.players);
    };

    const handleTurnStarted = (raw: unknown) => {
      const parsed = parseTurnStarted(raw);
      if (!parsed) return;

      if (parsed.players.length > 0) {
        playerOrderRef.current = parsed.players.map((player) => player.id);
        for (const player of parsed.players) {
          const record = ensurePlayer(player.id, player.name);
          if (parsed.playerId && player.id === parsed.playerId) {
            record.lastTurnStart = Date.now();
          } else {
            record.lastTurnStart = null;
          }
        }
      } else if (parsed.playerId) {
        const record = ensurePlayer(parsed.playerId);
        for (const [, entry] of statsRef.current) {
          entry.lastTurnStart = null;
        }
        record.lastTurnStart = Date.now();
      }

      updateSnapshots();
    };

    const handleWordAccepted = (raw: unknown) => {
      const parsed = parseWordAccepted(raw);
      if (!parsed) return;

      const record = ensurePlayer(parsed.playerId);
      const trimmedWord = parsed.word.trim();
      if (!trimmedWord) {
        record.lastTurnStart = null;
        updateSnapshots();
        return;
      }

      const now = Date.now();
      const turnStart = record.lastTurnStart;

      record.totalWords += 1;
      record.accuracyStreak += 1;

      if (trimmedWord.length >= 20) {
        record.longWords += 1;
      }
      if (trimmedWord.includes('-')) {
        record.hyphenatedWords += 1;
      }

      record.totalChars += trimmedWord.length;

      if (turnStart != null) {
        const reactionMs = Math.max(now - turnStart, 0);
        record.totalReactionMs += reactionMs;
      }

      record.lastTurnStart = null;

      updateSnapshots();
    };

    socket.on('gameStarted', handleGameStarted);
    socket.on('turnStarted', handleTurnStarted);
    socket.on('wordAccepted', handleWordAccepted);

    return () => {
      socket.off('gameStarted', handleGameStarted);
      socket.off('turnStarted', handleTurnStarted);
      socket.off('wordAccepted', handleWordAccepted);
    };
  }, [ensurePlayer, resetAll, updateSnapshots]);

  const registerRejection = useCallback(() => {
    const activeId = playerIdRef.current;
    if (!activeId) return;
    const record = statsRef.current.get(activeId);
    if (!record) return;
    record.accuracyStreak = 0;
    updateSnapshots();
  }, [updateSnapshots]);

  return useMemo(
    () => ({
      stats,
      registerRejection,
    }),
    [stats, registerRejection],
  );
}
