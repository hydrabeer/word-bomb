import type { Server } from 'socket.io';
import type { GameRoom } from '@game/domain/rooms/GameRoom';
import { setGameEngine } from '../engineRegistry';
import { createNewGame } from './createNewGame';
import { createGameEngine } from './createGameEngine';
import { emitGameStarted } from './emitGameStarted';

export function startGameForRoom(io: Server, room: GameRoom) {
  if (room.game) return;

  const game = createNewGame(room);
  if (!game) return;

  room.game = game;

  const engine = createGameEngine(io, room, game);
  setGameEngine(room.code, engine);

  emitGameStarted(io, room, game);
  engine.beginGame();
}
