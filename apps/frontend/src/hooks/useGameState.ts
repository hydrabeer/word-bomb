// apps/frontend/src/hooks/useGameState.ts
import { useState, useEffect } from 'react';
import { socket } from '../socket';
import type {
  GameCountdownStartedPayload,
  GameStartedPayload,
  TurnStartedPayload,
  PlayerUpdatedPayload,
} from '@game/domain/socket/types';
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
    function handleGameCountdownStarted(data: GameCountdownStartedPayload) {
      setCountdownDeadline(data.deadline);
    }

    function handleGameCountdownStopped() {
      setCountdownDeadline(null);
      setTimeLeftSec(0);
    }

    function handleGameStarted(data: GameStartedPayload) {
      setGameState({
        fragment: data.fragment,
        bombDuration: data.bombDuration,
        currentPlayerId: data.currentPlayer,
        players: data.players,
      });
      setCountdownDeadline(null);
      setGameStartedAt(Date.now());
    }

    function handleTurnStarted(data: TurnStartedPayload) {
      const newDeadline = Date.now() + data.bombDuration * 1000;
      setTurnDeadline(newDeadline);

      setLiveInputs((prev) => {
        const newState = { ...prev };
        if (data.playerId) {
          delete newState[data.playerId];
        }
        return newState;
      });

      setLastSubmittedWords((prev) => {
        const newState = { ...prev };
        if (data.playerId) {
          delete newState[data.playerId];
        }
        return newState;
      });

      setGameState((prev) =>
        prev
          ? {
              ...prev,
              fragment: data.fragment,
              bombDuration: data.bombDuration,
              currentPlayerId: data.playerId,
              players: data.players || prev.players,
            }
          : null,
      );
    }

    function handlePlayerTypingUpdate(data: {
      playerId: string;
      input: string;
    }) {
      setLiveInputs((prev) => ({
        ...prev,
        [data.playerId]: data.input,
      }));
    }

    function handlePlayerUpdated(data: PlayerUpdatedPayload) {
      setGameState((prev) => {
        if (!prev) return prev;
        const updatedPlayers = prev.players.map((p) =>
          p.id === data.playerId
            ? { ...p, lives: data.lives, isEliminated: data.lives <= 0 }
            : p,
        );
        return { ...prev, players: updatedPlayers };
      });
    }

    function handleGameEnded() {
      setGameStartedAt(null);
      setElapsedGameTime(0);
    }

    socket.on('gameCountdownStarted', handleGameCountdownStarted);
    socket.on('gameCountdownStopped', handleGameCountdownStopped);
    socket.on('gameStarted', handleGameStarted);
    socket.on('turnStarted', handleTurnStarted);
    socket.on('playerTypingUpdate', handlePlayerTypingUpdate);
    socket.on('playerUpdated', handlePlayerUpdated);
    socket.on('gameEnded', handleGameEnded);

    return () => {
      socket.off('gameCountdownStarted', handleGameCountdownStarted);
      socket.off('gameCountdownStopped', handleGameCountdownStopped);
      socket.off('gameStarted', handleGameStarted);
      socket.off('turnStarted', handleTurnStarted);
      socket.off('playerTypingUpdate', handlePlayerTypingUpdate);
      socket.off('playerUpdated', handlePlayerUpdated);
      socket.off('gameEnded', handleGameEnded);
    };
  }, []);

  // Word accepted effect
  useEffect(() => {
    const handleWordAccepted = (data: { playerId: string; word: string }) => {
      setLastSubmittedWords((prev) => ({
        ...prev,
        [data.playerId]: {
          word: data.word.trim(),
          fragment: gameState?.fragment ?? '',
        },
      }));

      setLastWordAcceptedBy(data.playerId);
      setTimeout(() => setLastWordAcceptedBy(null), 500);
    };

    socket.on('wordAccepted', handleWordAccepted);
    return () => {
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
    updateLiveInput: (playerId: string, input: string) => {
      socket.emit('playerTyping', { roomCode, playerId, input });
    },
  };
}
