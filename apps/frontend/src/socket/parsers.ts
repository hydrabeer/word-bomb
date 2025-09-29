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

const DEFAULT_PLAYER = {
  id: 'unknown',
  name: 'Unknown',
  isEliminated: false,
  lives: 0,
  isConnected: true,
} as const;

export interface PlayerEntryParsed {
  id: string;
  name: string;
  isEliminated: boolean;
  lives: number;
  isConnected: boolean;
  bonusProgress?: { remaining: number[]; total: number[] };
}

const createDefaultPlayerEntry = (): PlayerEntryParsed => ({
  id: DEFAULT_PLAYER.id,
  name: DEFAULT_PLAYER.name,
  isEliminated: DEFAULT_PLAYER.isEliminated,
  lives: DEFAULT_PLAYER.lives,
  isConnected: DEFAULT_PLAYER.isConnected,
});

const parseBonusProgress = (
  value: unknown,
): { remaining: number[]; total: number[] } | undefined => {
  if (!isObj(value)) return undefined;
  const { remaining, total } = value as {
    remaining?: unknown;
    total?: unknown;
  };
  if (!Array.isArray(remaining) || !Array.isArray(total)) return undefined;

  const remainingNums = remaining.filter(
    (n): n is number => typeof n === 'number',
  );
  const totalNums = total.filter((n): n is number => typeof n === 'number');

  return { remaining: remainingNums, total: totalNums };
};

const parsePlayerEntries = (players: unknown[]): PlayerEntryParsed[] =>
  players.map((entry) => {
    if (!isObj(entry)) {
      return createDefaultPlayerEntry();
    }

    const obj = entry;
    const parsed: PlayerEntryParsed = {
      id: typeof obj.id === 'string' ? obj.id : DEFAULT_PLAYER.id,
      name: typeof obj.name === 'string' ? obj.name : DEFAULT_PLAYER.name,
      isEliminated: !!obj.isEliminated,
      lives: typeof obj.lives === 'number' ? obj.lives : DEFAULT_PLAYER.lives,
      isConnected:
        typeof obj.isConnected === 'boolean'
          ? obj.isConnected
          : DEFAULT_PLAYER.isConnected,
    };

    const bonus = parseBonusProgress(obj.bonusProgress);
    if (bonus) parsed.bonusProgress = bonus;

    return parsed;
  });

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
  const players = parsePlayerEntries(v.players as unknown[]);
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
  const players = parsePlayerEntries(v.players as unknown[]);
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

export interface RoomRulesParsed {
  roomCode: string;
  rules: {
    maxLives: number;
    startingLives: number;
    bonusTemplate: number[];
    minTurnDuration: number;
    minWordsPerPrompt: number;
  };
}

export function parseRoomRulesUpdated(v: unknown): RoomRulesParsed | null {
  if (!isObj(v) || typeof v.roomCode !== 'string') return null;
  const rawRules = (v as { rules?: unknown }).rules;
  if (!isObj(rawRules)) return null;
  const {
    maxLives,
    startingLives,
    bonusTemplate,
    minTurnDuration,
    minWordsPerPrompt,
  } = rawRules;
  if (
    typeof maxLives !== 'number' ||
    typeof startingLives !== 'number' ||
    typeof minTurnDuration !== 'number' ||
    typeof minWordsPerPrompt !== 'number' ||
    !Array.isArray(bonusTemplate)
  )
    return null;
  const templateNumbers = bonusTemplate.filter(
    (n): n is number => typeof n === 'number',
  );
  if (
    templateNumbers.length !== bonusTemplate.length ||
    templateNumbers.length !== 26
  )
    return null;
  return {
    roomCode: v.roomCode,
    rules: {
      maxLives,
      startingLives,
      minTurnDuration,
      minWordsPerPrompt,
      bonusTemplate: [...templateNumbers],
    },
  };
}
