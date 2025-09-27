import type { Server } from 'socket.io';
import type { GameRoom } from '@game/domain';
import type { TypedServer } from '../../socket/typedSocket';
import { setGameEngine } from '../engineRegistry';
import { createNewGame } from './createNewGame';
import { createGameEngine } from './createGameEngine';
import { RoomBroadcaster } from '../../core/RoomBroadcaster';

export function startGameForRoom(io: Server | TypedServer, room: GameRoom) {
  if (room.game) return;

  const game = createNewGame(room);
  if (!game) return;

  room.game = game;

  const engine = createGameEngine(io, room, game);
  setGameEngine(room.code, engine);

  new RoomBroadcaster(io).gameStarted(room, game);
  engine.beginGame();
}
