// Lightweight runtime validators (no external schema lib) to keep ESLint strict rules satisfied.
// Each validator returns { ok: true, data } or { ok: false }

import type {
  GameStartedPayload,
  TurnStartedPayload,
  PlayerTypingUpdatePayload,
  PlayerUpdatedPayload,
  GameEndedPayload,
  WordAcceptedPayload,
  GameCountdownStartedPayload,
} from '@word-bomb/types';

export type Result<T> = { ok: true; data: T } | { ok: false };

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

// Re-exported with local naming to avoid breaking any existing imports.
export type GameStartedV = GameStartedPayload;
export type TurnStartedV = TurnStartedPayload;
export type PlayerTypingUpdateV = PlayerTypingUpdatePayload;
export type PlayerUpdatedV = PlayerUpdatedPayload;
export type GameEndedV = GameEndedPayload;
export type WordAcceptedV = WordAcceptedPayload;
export type GameCountdownStartedV = GameCountdownStartedPayload;

interface InternalPlayerShape {
  id: string;
  name: string;
  isEliminated: boolean;
  lives: number;
}

const parsePlayersArray = (value: unknown): InternalPlayerShape[] | null => {
  if (!Array.isArray(value)) return null;
  const result: InternalPlayerShape[] = [];
  for (const raw of value) {
    if (!isObj(raw)) return null;
    const { id, name, isEliminated, lives } = raw as {
      id?: unknown;
      name?: unknown;
      isEliminated?: unknown;
      lives?: unknown;
    };
    if (
      typeof id !== 'string' ||
      typeof name !== 'string' ||
      typeof lives !== 'number'
    )
      return null;
    result.push({
      id,
      name,
      isEliminated: Boolean(isEliminated),
      lives,
    });
  }
  return result;
};

export function validateGameStarted(v: unknown): Result<GameStartedV> {
  if (!isObj(v)) return { ok: false };
  const obj: Record<string, unknown> = v;
  const roomCode = obj.roomCode;
  const fragment = obj.fragment;
  const bombDuration = obj.bombDuration;
  const currentPlayer = obj.currentPlayer;
  const leaderId = obj.leaderId;
  const playersRaw = obj.players;

  if (
    typeof roomCode !== 'string' ||
    typeof fragment !== 'string' ||
    typeof bombDuration !== 'number'
  )
    return { ok: false };
  if (!(typeof currentPlayer === 'string' || currentPlayer === null))
    return { ok: false };
  if (!(typeof leaderId === 'string' || leaderId === null))
    return { ok: false };
  const players = parsePlayersArray(playersRaw);
  if (!players) return { ok: false };
  return {
    ok: true,
    data: {
      roomCode,
      fragment,
      bombDuration,
      currentPlayer: currentPlayer,
      leaderId: leaderId,
      players,
    },
  };
}

export function validateTurnStarted(v: unknown): Result<TurnStartedV> {
  if (!isObj(v)) return { ok: false };
  const obj: Record<string, unknown> = v;
  const playerId = obj.playerId;
  const fragment = obj.fragment;
  const bombDuration = obj.bombDuration;
  const playersRaw = obj.players;

  if (!(typeof playerId === 'string' || playerId === null))
    return { ok: false };
  if (typeof fragment !== 'string' || typeof bombDuration !== 'number')
    return { ok: false };
  const players = parsePlayersArray(playersRaw);
  if (!players) return { ok: false };
  return {
    ok: true,
    data: {
      playerId: playerId,
      fragment,
      bombDuration,
      players,
    },
  };
}

export function validatePlayerTypingUpdate(
  v: unknown,
): Result<PlayerTypingUpdateV> {
  if (!isObj(v)) return { ok: false };
  const obj: Record<string, unknown> = v;
  if (typeof obj.playerId !== 'string' || typeof obj.input !== 'string')
    return { ok: false };
  return { ok: true, data: { playerId: obj.playerId, input: obj.input } };
}

export function validatePlayerUpdated(v: unknown): Result<PlayerUpdatedV> {
  if (!isObj(v)) return { ok: false };
  const obj: Record<string, unknown> = v;
  if (typeof obj.playerId !== 'string' || typeof obj.lives !== 'number')
    return { ok: false };
  return { ok: true, data: { playerId: obj.playerId, lives: obj.lives } };
}

export function validateGameEnded(v: unknown): Result<GameEndedV> {
  if (!isObj(v)) return { ok: false };
  const obj: Record<string, unknown> = v;
  const winnerId = Object.prototype.hasOwnProperty.call(obj, 'winnerId')
    ? obj.winnerId
    : null;
  if (
    !(
      winnerId === null ||
      (typeof winnerId === 'string' && winnerId.length > 0) ||
      typeof winnerId === 'string'
    )
  )
    return { ok: false };
  return { ok: true, data: { winnerId: winnerId } };
}

export function validateWordAccepted(v: unknown): Result<WordAcceptedV> {
  if (!isObj(v)) return { ok: false };
  const obj: Record<string, unknown> = v;
  if (typeof obj.playerId !== 'string' || typeof obj.word !== 'string')
    return { ok: false };
  return { ok: true, data: { playerId: obj.playerId, word: obj.word } };
}

export function validateGameCountdownStarted(
  v: unknown,
): Result<GameCountdownStartedV> {
  if (!isObj(v)) return { ok: false };
  const obj: Record<string, unknown> = v;
  if (typeof obj.deadline !== 'number') return { ok: false };
  return { ok: true, data: { deadline: obj.deadline } };
}
