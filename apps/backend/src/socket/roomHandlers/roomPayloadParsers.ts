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
  roomCode: string;
  playerId: string;
  name: string;
}

export interface LeaveRoomParsed {
  roomCode: string;
  playerId: string;
}

export interface SetPlayerSeatedParsed {
  roomCode: string;
  playerId: string;
  seated: boolean;
}

export interface StartGameParsed {
  roomCode: string;
}

export interface PlayerTypingParsed {
  roomCode: string;
  playerId: string;
  input: string;
}

export interface SubmitWordParsed {
  roomCode: string;
  playerId: string;
  word: string;
  clientActionId?: string;
}

export interface UpdateRoomRulesParsed {
  roomCode: string;
  rules: unknown;
}

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

export const parseLeaveRoom = (raw: unknown): LeaveRoomParsed | null => {
  const parsed = parseRoomAndPlayer(raw);
  return parsed
    ? { roomCode: parsed.roomCode, playerId: parsed.playerId }
    : null;
};

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

export const parseStartGame = (raw: unknown): StartGameParsed | null => {
  const parsed = parseRoomContext(raw);
  if (!parsed) return null;
  return { roomCode: parsed.roomCode };
};

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

export const parseUpdateRoomRules = (
  raw: unknown,
): UpdateRoomRulesParsed | null => {
  const parsed = parseRoomContext(raw);
  if (!parsed) return null;
  return { roomCode: parsed.roomCode, rules: parsed.data.rules };
};
