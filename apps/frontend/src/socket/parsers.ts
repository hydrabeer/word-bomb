// Runtime parsing helpers for socket event payloads.
// Keep extremely small & dependency-free to avoid complexity.

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object';
const pickStringOrNull = (
  o: Record<string, unknown>,
  key: string,
): string | null => {
  if (!(key in o)) return null;
  const val = o[key];
  if (typeof val === 'string') return val;
  if (val === null) return null;
  return null;
};

export interface CountdownStartedParsed {
  deadline: number;
}
export function parseCountdownStarted(
  v: unknown,
): CountdownStartedParsed | null {
  return isObj(v) && typeof v.deadline === 'number'
    ? { deadline: v.deadline }
    : null;
}

export interface PlayerEntryParsed {
  id: string;
  name: string;
  isEliminated: boolean;
  lives: number;
}
export interface GameStartedParsed {
  fragment: string;
  bombDuration: number;
  currentPlayer: string | null;
  players: PlayerEntryParsed[];
}
export function parseGameStarted(v: unknown): GameStartedParsed | null {
  if (!isObj(v)) return null;
  if (
    typeof v.fragment !== 'string' ||
    typeof v.bombDuration !== 'number' ||
    !Array.isArray(v.players)
  )
    return null;
  const cp = pickStringOrNull(v, 'currentPlayer');
  const players: PlayerEntryParsed[] = (v.players as unknown[]).map((p) => {
    if (p && typeof p === 'object') {
      const o = p as Record<string, unknown>;
      const id = typeof o.id === 'string' ? o.id : 'unknown';
      const name = typeof o.name === 'string' ? o.name : 'Unknown';
      const isEliminated = !!o.isEliminated;
      const lives = typeof o.lives === 'number' ? o.lives : 0;
      return { id, name, isEliminated, lives };
    }
    return { id: 'unknown', name: 'Unknown', isEliminated: false, lives: 0 };
  });
  return {
    fragment: v.fragment,
    bombDuration: v.bombDuration,
    currentPlayer: cp,
    players,
  };
}

export interface TurnStartedParsed {
  fragment: string;
  bombDuration: number;
  playerId: string | null;
  players: PlayerEntryParsed[];
}
export function parseTurnStarted(v: unknown): TurnStartedParsed | null {
  if (!isObj(v)) return null;
  if (
    typeof v.fragment !== 'string' ||
    typeof v.bombDuration !== 'number' ||
    !Array.isArray(v.players)
  )
    return null;
  const playerId = pickStringOrNull(v, 'playerId');
  const players: PlayerEntryParsed[] = (v.players as unknown[]).map((p) => {
    if (p && typeof p === 'object') {
      const o = p as Record<string, unknown>;
      return {
        id: typeof o.id === 'string' ? o.id : 'unknown',
        name: typeof o.name === 'string' ? o.name : 'Unknown',
        isEliminated: !!o.isEliminated,
        lives: typeof o.lives === 'number' ? o.lives : 0,
      };
    }
    return { id: 'unknown', name: 'Unknown', isEliminated: false, lives: 0 };
  });
  return {
    fragment: v.fragment,
    bombDuration: v.bombDuration,
    playerId,
    players,
  };
}

export interface PlayerTypingParsed {
  playerId: string;
  input: string;
}
export function parsePlayerTypingUpdate(v: unknown): PlayerTypingParsed | null {
  if (!isObj(v)) return null;
  if (typeof v.playerId !== 'string' || typeof v.input !== 'string')
    return null;
  return { playerId: v.playerId, input: v.input };
}

export interface PlayerUpdatedParsed {
  playerId: string;
  lives: number;
}
export function parsePlayerUpdated(v: unknown): PlayerUpdatedParsed | null {
  if (!isObj(v)) return null;
  if (typeof v.playerId !== 'string' || typeof v.lives !== 'number')
    return null;
  return { playerId: v.playerId, lives: v.lives };
}

export interface GameEndedParsed {
  winnerId: string | null;
}
export function parseGameEnded(v: unknown): GameEndedParsed | null {
  if (!isObj(v)) return null;
  if (
    'winnerId' in v &&
    !(
      typeof (v as { winnerId?: unknown }).winnerId === 'string' ||
      (v as { winnerId?: unknown }).winnerId === null
    )
  )
    return null;
  const value = (v as { winnerId?: string | null }).winnerId ?? null;
  return { winnerId: value };
}

export interface WordAcceptedParsed {
  playerId: string;
  word: string;
}
export function parseWordAccepted(v: unknown): WordAcceptedParsed | null {
  if (!isObj(v)) return null;
  if (typeof v.playerId !== 'string' || typeof v.word !== 'string') return null;
  return { playerId: v.playerId, word: v.word };
}

export interface ActionAckParsed {
  clientActionId: string;
  success: boolean;
  error?: string;
}
export function parseActionAck(v: unknown): ActionAckParsed | null {
  if (!isObj(v)) return null;
  if (typeof v.clientActionId !== 'string' || typeof v.success !== 'boolean')
    return null;
  return {
    clientActionId: v.clientActionId,
    success: v.success,
    error: typeof v.error === 'string' ? v.error : undefined,
  };
}
