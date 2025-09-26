// apps/frontend/src/hooks/useGameState.ts
import { useState, useEffect } from 'react';
import { socket } from '../socket';
import {
  parseCountdownStarted,
  parseGameStarted,
  parseTurnStarted,
  parsePlayerTypingUpdate,
  parsePlayerUpdated,
  parseGameEnded,
  parseWordAccepted,
} from '../socket/parsers';
import type { GameState } from '../components/GameBoard';

export function useGameState(roomCode: string) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [countdownDeadline, setCountdownDeadline] = useState<number | null>(
    null,
  );
  const [timeLeftSec, setTimeLeftSec] = useState<number>(0);
  const [turnDeadline, setTurnDeadline] = useState<number | null>(null);
  const [bombCountdown, setBombCountdown] = useState<number>(0);
  const [gameStartedAt, setGameStartedAt] = useState<number | null>(null);
  const [elapsedGameTime, setElapsedGameTime] = useState<number>(0);
  const [liveInputs, setLiveInputs] = useState<Record<string, string>>({});
  const [lastSubmittedWords, setLastSubmittedWords] = useState<
    Record<string, { word: string; fragment: string }>
  >({});
  const [lastWordAcceptedBy, setLastWordAcceptedBy] = useState<string | null>(
    null,
  );
  const [winnerId, setWinnerId] = useState<string | null>(null);

  // Countdown timer effect
  useEffect(() => {
    if (countdownDeadline == null) {
      setTimeLeftSec(0);
      return;
    }
    const timer = setInterval(() => {
      const diff = countdownDeadline - Date.now();
      if (diff <= 0) {
        setCountdownDeadline(null);
        setTimeLeftSec(0);
        clearInterval(timer);
      } else {
        setTimeLeftSec(Math.ceil(diff / 1000));
      }
    }, 250);
    return () => clearInterval(timer);
  }, [countdownDeadline]);

  // Game timer effect
  useEffect(() => {
    if (!gameStartedAt) return;

    const interval = setInterval(() => {
      setElapsedGameTime(Math.floor((Date.now() - gameStartedAt) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [gameStartedAt]);

  // Bomb countdown effect
  useEffect(() => {
    if (!turnDeadline) return;
    const interval = setInterval(() => {
      const left = Math.ceil((turnDeadline - Date.now()) / 1000);
      setBombCountdown(Math.max(left, 0));
    }, 250);
    return () => clearInterval(interval);
  }, [turnDeadline]);

  // Socket event handlers
  useEffect(() => {
    // --- Parsing helpers (structural, no dependency on external event typing inference) ---
    // --- Handlers using parsed data only ---
    function handleGameCountdownStarted(raw: unknown) {
      const unknownResult = parseCountdownStarted(raw);
      if (!unknownResult) return;
      const deadline = unknownResult.deadline; // primitive copy prevents unsafe member lint
      setCountdownDeadline(deadline);
    }
    function handleGameCountdownStopped() {
      setCountdownDeadline(null);
      setTimeLeftSec(0);
    }
    function handleGameStarted(raw: unknown) {
      const parsed = parseGameStarted(raw);
      if (!parsed) return;
      const { fragment, bombDuration, currentPlayer, players } = parsed;
      setWinnerId(null);
      setGameState({
        fragment,
        bombDuration,
        currentPlayerId: currentPlayer,
        players,
      });
      setCountdownDeadline(null);
      setGameStartedAt(Date.now());
    }
    function handleTurnStarted(raw: unknown) {
      const parsed = parseTurnStarted(raw);
      if (!parsed) return;
      const { bombDuration, playerId, fragment, players } = parsed;
      setTurnDeadline(Date.now() + bombDuration * 1000);
      setLiveInputs((prev) => {
        if (!playerId) return prev;
        const copy = { ...prev };
        delete copy[playerId];
        return copy;
      });
      setLastSubmittedWords((prev) => {
        if (!playerId) return prev;
        const copy = { ...prev };
        delete copy[playerId];
        return copy;
      });
      setGameState((prev) => {
        if (!prev) return null;
        const nextPlayers = players.length ? players : prev.players;
        return {
          ...prev,
          fragment,
          bombDuration,
          currentPlayerId: playerId,
          players: nextPlayers,
        };
      });
    }
    function handlePlayerTypingUpdate(raw: unknown) {
      const parsed = parsePlayerTypingUpdate(raw);
      if (!parsed) return;
      const { playerId, input } = parsed;
      setLiveInputs((prev) => ({ ...prev, [playerId]: input }));
    }
    function handlePlayerUpdated(raw: unknown) {
      const parsed = parsePlayerUpdated(raw);
      if (!parsed) return;
      const { playerId, lives } = parsed;
      setGameState((prev) => {
        if (!prev) return prev;
        const updated = prev.players.map((p) =>
          p.id === playerId ? { ...p, lives, isEliminated: lives <= 0 } : p,
        );
        return { ...prev, players: updated };
      });
    }
    function handleGameEnded(raw: unknown) {
      const parsed = parseGameEnded(raw);
      if (!parsed) return;
      const winner = parsed.winnerId;
      setGameStartedAt(null);
      setElapsedGameTime(0);
      setLastSubmittedWords({});
      setLiveInputs({});
      setLastWordAcceptedBy(null);
      setTurnDeadline(null);
      setBombCountdown(0);
      setWinnerId(winner);
      setGameState(null);
    }
    function handleWordAccepted(raw: unknown) {
      const parsed = parseWordAccepted(raw);
      if (!parsed) return;
      const playerId = parsed.playerId;
      const word = parsed.word;
      const fragmentSnapshot = gameState?.fragment ?? '';
      setLastSubmittedWords((prev) => ({
        ...prev,
        [playerId]: { word: word.trim(), fragment: fragmentSnapshot },
      }));
      setLastWordAcceptedBy(playerId);
      setTimeout(() => setLastWordAcceptedBy(null), 500);
    }

    socket.on('gameCountdownStarted', handleGameCountdownStarted);
    socket.on('gameCountdownStopped', handleGameCountdownStopped);
    socket.on('gameStarted', handleGameStarted);
    socket.on('turnStarted', handleTurnStarted);
    socket.on('playerTypingUpdate', handlePlayerTypingUpdate);
    socket.on('playerUpdated', handlePlayerUpdated);
    socket.on('gameEnded', handleGameEnded);
    socket.on('wordAccepted', handleWordAccepted);

    return () => {
      socket.off('gameCountdownStarted', handleGameCountdownStarted);
      socket.off('gameCountdownStopped', handleGameCountdownStopped);
      socket.off('gameStarted', handleGameStarted);
      socket.off('turnStarted', handleTurnStarted);
      socket.off('playerTypingUpdate', handlePlayerTypingUpdate);
      socket.off('playerUpdated', handlePlayerUpdated);
      socket.off('gameEnded', handleGameEnded);
      socket.off('wordAccepted', handleWordAccepted);
    };
  }, [gameState?.fragment]);

  return {
    gameState,
    countdownDeadline,
    timeLeftSec,
    bombCountdown,
    elapsedGameTime,
    liveInputs,
    lastSubmittedWords,
    lastWordAcceptedBy,
    winnerId,
    updateLiveInput: (playerId: string, input: string) => {
      socket.emit('playerTyping', { roomCode, playerId, input });
    },
  };
}
