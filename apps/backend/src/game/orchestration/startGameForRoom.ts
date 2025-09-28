import type { GameRoom } from '@game/domain';
import type { TypedServer } from '../../socket/typedSocket';
import { setGameEngine } from '../engineRegistry';
import { createNewGame } from './createNewGame';
import { createGameEngine } from './createGameEngine';
import { RoomBroadcaster } from '../../core/RoomBroadcaster';
import { createDictionaryPort } from '../../dictionary';
import type { DictionaryPort } from '../../dictionary';

export interface StartGameForRoomOptions {
  dictionary?: DictionaryPort;
}

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
