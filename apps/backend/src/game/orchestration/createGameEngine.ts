import { GameEngine } from '../GameEngine';
import type { Game, GameRoom } from '@game/domain';
import type { TypedServer } from '../../socket/typedSocket';
import type { ServerToClientEvents } from '@word-bomb/types';
import { emitPlayers } from './emitPlayers';
import { RoomBroadcaster } from '../../core/RoomBroadcaster';
import { socketRoomId } from '../../utils/socketRoomId';
import { deleteGameEngine } from '../engineRegistry';

export function createGameEngine(
  io: TypedServer,
  room: GameRoom,
  game: Game,
): GameEngine {
  const broadcaster = new RoomBroadcaster(io);

  return new GameEngine({
    game,
    emit: <K extends keyof ServerToClientEvents>(
      event: K,
      ...args: Parameters<ServerToClientEvents[K]>
    ) => {
      io.to(socketRoomId(room.code)).emit(event, ...args);
    },
    scheduler: {
      schedule: (delayMs, cb) => setTimeout(cb, delayMs),
      cancel: (token) => {
        clearTimeout(token as NodeJS.Timeout);
      },
    },
    eventsPort: {
      turnStarted: () => {
        broadcaster.turnStarted(game);
      },
      playerUpdated: (playerId, lives) => {
        broadcaster.playerUpdated(room.code, playerId, lives);
      },
      wordAccepted: (playerId, word) => {
        broadcaster.wordAccepted(room.code, playerId, word);
      },
      gameEnded: (winnerId) => {
        broadcaster.gameEnded(room.code, winnerId);
        room.endGame();
        room.game = undefined;
        emitPlayers(io, room);
        deleteGameEngine(room.code);
      },
    },
  });
}
