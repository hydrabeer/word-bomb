/** Utility type guard ensuring an unknown value is a non-null object. */
const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object';

interface RoomContext {
  roomCode: string;
  data: Record<string, unknown>;
}

interface RoomPlayerContext extends RoomContext {
  playerId: string;
}

const parseRoomContext = (raw: unknown): RoomContext | null => {
  if (!isObject(raw)) return null;
  const { roomCode, ...rest } = raw;
  if (typeof roomCode !== 'string') return null;
  return { roomCode, data: rest };
};

const parseRoomAndPlayer = (raw: unknown): RoomPlayerContext | null => {
  const parsed = parseRoomContext(raw);
  if (!parsed) return null;
  const { playerId } = parsed.data;
  if (typeof playerId !== 'string') return null;
  return { ...parsed, playerId };
};

export interface JoinRoomParsed {
  /** Lobby identifier supplied by the client. */
  roomCode: string;
  /** Unique player identifier scoped to the room. */
  playerId: string;
  /** Display name requested by the player. */
  name: string;
}

export interface LeaveRoomParsed {
  /** Lobby identifier supplied by the client. */
  roomCode: string;
  /** Unique player identifier scoped to the room. */
  playerId: string;
}

export interface SetPlayerSeatedParsed {
  /** Lobby identifier supplied by the client. */
  roomCode: string;
  /** Unique player identifier scoped to the room. */
  playerId: string;
  /** Whether the player intends to participate in the next game. */
  seated: boolean;
}

export interface StartGameParsed {
  /** Lobby identifier supplied by the client. */
  roomCode: string;
}

export interface PlayerTypingParsed {
  /** Lobby identifier supplied by the client. */
  roomCode: string;
  /** Unique player identifier scoped to the room. */
  playerId: string;
  /** Current input contents provided by the player. */
  input: string;
}

export interface SubmitWordParsed {
  /** Lobby identifier supplied by the client. */
  roomCode: string;
  /** Unique player identifier scoped to the room. */
  playerId: string;
  /** Word submitted for validation. */
  word: string;
  /** Optional identifier used by the client to correlate the acknowledgement. */
  clientActionId?: string;
}

export interface UpdateRoomRulesParsed {
  /** Lobby identifier supplied by the client. */
  roomCode: string;
  /** Arbitrary rule payload provided by the caller. */
  rules: unknown;
}

/**
 * Parses the payload for a `joinRoom` event emitted by the client.
 *
 * @param raw - Untrusted event payload supplied by Socket.IO.
 * @returns Structured join payload or `null` when invalid.
 */
export const parseJoinRoom = (raw: unknown): JoinRoomParsed | null => {
  const parsed = parseRoomAndPlayer(raw);
  if (!parsed) return null;
  const { data } = parsed;
  return {
    roomCode: parsed.roomCode,
    playerId: parsed.playerId,
    name: typeof data.name === 'string' ? data.name : '',
  };
};

/**
 * Parses the payload for a `leaveRoom` event emitted by the client.
 *
 * @param raw - Untrusted event payload supplied by Socket.IO.
 * @returns Structured leave payload or `null` when invalid.
 */
export const parseLeaveRoom = (raw: unknown): LeaveRoomParsed | null => {
  const parsed = parseRoomAndPlayer(raw);
  return parsed
    ? { roomCode: parsed.roomCode, playerId: parsed.playerId }
    : null;
};

/**
 * Parses the payload for a `setPlayerSeated` event emitted by the client.
 *
 * @param raw - Untrusted event payload supplied by Socket.IO.
 * @returns Structured seating payload or `null` when invalid.
 */
export const parseSetPlayerSeated = (
  raw: unknown,
): SetPlayerSeatedParsed | null => {
  const parsed = parseRoomAndPlayer(raw);
  if (!parsed) return null;
  return {
    roomCode: parsed.roomCode,
    playerId: parsed.playerId,
    seated: Boolean(parsed.data.seated),
  };
};

/**
 * Parses the payload for a `startGame` event emitted by the client.
 *
 * @param raw - Untrusted event payload supplied by Socket.IO.
 * @returns Structured start-game payload or `null` when invalid.
 */
export const parseStartGame = (raw: unknown): StartGameParsed | null => {
  const parsed = parseRoomContext(raw);
  if (!parsed) return null;
  return { roomCode: parsed.roomCode };
};

/**
 * Parses the payload for a `playerTyping` event emitted by the client.
 *
 * @param raw - Untrusted event payload supplied by Socket.IO.
 * @returns Structured typing payload or `null` when invalid.
 */
export const parsePlayerTyping = (raw: unknown): PlayerTypingParsed | null => {
  const parsed = parseRoomAndPlayer(raw);
  if (!parsed) return null;
  const input = parsed.data.input;
  return {
    roomCode: parsed.roomCode,
    playerId: parsed.playerId,
    input: typeof input === 'string' ? input : '',
  };
};

/**
 * Parses the payload for a `submitWord` event emitted by the client.
 *
 * @param raw - Untrusted event payload supplied by Socket.IO.
 * @returns Structured word submission payload or `null` when invalid.
 */
export const parseSubmitWord = (raw: unknown): SubmitWordParsed | null => {
  const parsed = parseRoomAndPlayer(raw);
  if (!parsed) return null;
  const { data } = parsed;
  const { word, clientActionId } = data;
  if (typeof word !== 'string') return null;
  return {
    roomCode: parsed.roomCode,
    playerId: parsed.playerId,
    word,
    clientActionId:
      typeof clientActionId === 'string' ? clientActionId : undefined,
  };
};

/**
 * Parses the payload for an `updateRoomRules` event emitted by the client.
 *
 * @param raw - Untrusted event payload supplied by Socket.IO.
 * @returns Structured room rule payload or `null` when invalid.
 */
export const parseUpdateRoomRules = (
  raw: unknown,
): UpdateRoomRulesParsed | null => {
  const parsed = parseRoomContext(raw);
  if (!parsed) return null;
  return { roomCode: parsed.roomCode, rules: parsed.data.rules };
};
