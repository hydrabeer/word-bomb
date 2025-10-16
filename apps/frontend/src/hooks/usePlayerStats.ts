// apps/frontend/src/hooks/usePlayerStats.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { socket } from '../socket';
import {
  parseGameStarted,
  parseTurnStarted,
  parseWordAccepted,
} from '../socket/parsers';

export interface PlayerStatsSnapshot {
  username: string;
  totalWords: number;
  averageWpm: number | null;
  averageReactionSeconds: number | null;
  longWords: number;
  accuracyStreak: number;
  hyphenatedWords: number;
}

const createInitialStats = (username: string): PlayerStatsSnapshot => ({
  username,
  totalWords: 0,
  averageWpm: null,
  averageReactionSeconds: null,
  longWords: 0,
  accuracyStreak: 0,
  hyphenatedWords: 0,
});

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
  const turnStartRef = useRef<number | null>(null);
  const totalCharsRef = useRef(0);
  const totalReactionMsRef = useRef(0);
  const longWordsRef = useRef(0);
  const hyphenWordsRef = useRef(0);
  const wordCountRef = useRef(0);
  const streakRef = useRef(0);

  const [stats, setStats] = useState<PlayerStatsSnapshot>(() =>
    createInitialStats(username),
  );

  const resetAll = useCallback((nextUsername: string) => {
    usernameRef.current = nextUsername;
    turnStartRef.current = null;
    totalCharsRef.current = 0;
    totalReactionMsRef.current = 0;
    longWordsRef.current = 0;
    hyphenWordsRef.current = 0;
    wordCountRef.current = 0;
    streakRef.current = 0;
    setStats(createInitialStats(nextUsername));
  }, []);

  useEffect(() => {
    if (usernameRef.current === username) return;
    usernameRef.current = username;
    setStats((prev) => ({ ...prev, username }));
  }, [username]);

  useEffect(() => {
    resetAll(usernameRef.current);
  }, [roomCode, playerId, resetAll]);

  useEffect(() => {
    const handleGameStarted = (raw: unknown) => {
      const parsed = parseGameStarted(raw);
      if (!parsed) return;
      resetAll(usernameRef.current);
    };

    const handleTurnStarted = (raw: unknown) => {
      const parsed = parseTurnStarted(raw);
      if (!parsed) return;
      if (parsed.playerId === playerId) {
        turnStartRef.current = Date.now();
      } else if (parsed.playerId) {
        turnStartRef.current = null;
      }
    };

    const handleWordAccepted = (raw: unknown) => {
      const parsed = parseWordAccepted(raw);
      if (!parsed || parsed.playerId !== playerId) return;

      const trimmedWord = parsed.word.trim();
      const now = Date.now();
      const turnStart = turnStartRef.current;

      wordCountRef.current += 1;
      streakRef.current += 1;

      if (trimmedWord.length >= 20) {
        longWordsRef.current += 1;
      }
      if (trimmedWord.includes('-')) {
        hyphenWordsRef.current += 1;
      }

      totalCharsRef.current += trimmedWord.length;

      if (turnStart != null) {
        const reactionMs = Math.max(now - turnStart, 0);
        totalReactionMsRef.current += reactionMs;
      }

      const totalWords = wordCountRef.current;
      const recordedReactionMs = totalReactionMsRef.current;
      const recordedChars = totalCharsRef.current;

      const averageReactionSeconds =
        totalWords > 0 && recordedReactionMs > 0
          ? recordedReactionMs / totalWords / 1000
          : null;

      const averageWpm =
        recordedReactionMs > 0 && recordedChars > 0
          ? (recordedChars * 60000) / (5 * Math.max(recordedReactionMs, 1))
          : null;

      setStats({
        username: usernameRef.current,
        totalWords,
        averageWpm,
        averageReactionSeconds,
        longWords: longWordsRef.current,
        accuracyStreak: streakRef.current,
        hyphenatedWords: hyphenWordsRef.current,
      });

      turnStartRef.current = null;
    };

    socket.on('gameStarted', handleGameStarted);
    socket.on('turnStarted', handleTurnStarted);
    socket.on('wordAccepted', handleWordAccepted);

    return () => {
      socket.off('gameStarted', handleGameStarted);
      socket.off('turnStarted', handleTurnStarted);
      socket.off('wordAccepted', handleWordAccepted);
    };
  }, [playerId, resetAll]);

  const registerRejection = useCallback(() => {
    streakRef.current = 0;
    setStats((prev) => ({
      ...prev,
      accuracyStreak: 0,
    }));
  }, []);

  return useMemo(
    () => ({
      stats,
      registerRejection,
    }),
    [stats, registerRejection],
  );
}
