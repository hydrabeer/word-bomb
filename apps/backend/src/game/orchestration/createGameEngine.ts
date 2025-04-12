import { GameEngine } from '../GameEngine';
import type { GameRoom } from '@game/domain/rooms/GameRoom';
import type { Game } from '@game/domain/game/Game';
import type { TypedServer } from '../../socket/typedSocket';
import type { ServerToClientEvents } from '@game/domain/socket/types';
import { broadcastTurnState } from './broadcastTurnState';
import { emitPlayers } from './emitPlayers';
import { socketRoomId } from '../../utils/socketRoomId';

export function createGameEngine(
  io: TypedServer,
  room: GameRoom,
  game: Game,
): GameEngine {
  return new GameEngine({
    game,

    emit: <K extends keyof ServerToClientEvents>(
      event: K,
      ...args: Parameters<ServerToClientEvents[K]>
    ) => {
      io.to(socketRoomId(room.code)).emit(event, ...args);
    },

    onTurnStarted: () => {
      broadcastTurnState(io, room.code, game);
    },

    onGameEnded: (winnerId) => {
      io.to(socketRoomId(room.code)).emit('gameEnded', { winnerId });
      room.endGame();
      room.game = undefined;
      emitPlayers(io, room);
    },
  });
}
