import type { GameRoom } from '@game/domain/rooms/GameRoom';
import type { TypedServer } from '../../../platform/socket/typedSocket';
import { setGameEngine } from '../engine/engineRegistry';
import { createNewGame } from './createNewGame';
import { createGameEngine } from './createGameEngine';
import { RoomBroadcaster } from '../../../platform/socket/RoomBroadcaster';
import { createDictionaryPort } from '../../../platform/dictionary';
import type { DictionaryPort } from '../../../platform/dictionary';

/**
 * Optional dependencies used when starting a game for a room.
 */
export interface StartGameForRoomOptions {
  dictionary?: DictionaryPort;
}

/**
 * Attempts to create and start a new game for the provided room, wiring up an engine.
 *
 * @param io - The typed socket server used for broadcasting lifecycle events.
 * @param room - The room requesting a new game session.
 * @param options - Optional overrides for dependencies such as the dictionary.
 */
export function startGameForRoom(
  io: TypedServer,
  room: GameRoom,
  options: StartGameForRoomOptions = {},
) {
  if (room.game) return;

  const dictionary = options.dictionary ?? createDictionaryPort();
  const game = createNewGame(room, dictionary);
  if (!game) return;

  room.game = game;

  const engine = createGameEngine(io, room, game, dictionary);
  setGameEngine(room.code, engine);

  new RoomBroadcaster(io).gameStarted(room, game);
  engine.beginGame();
}
