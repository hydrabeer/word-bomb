import type { TypedServer } from '../../socket/typedSocket';
import type { GameRoom } from '@game/domain/rooms/GameRoom';
import type { Game } from '@game/domain/game/Game';
import { socketRoomId } from '../../utils/socketRoomId';
import { formatPlayers } from './formatPlayers';

export function emitGameStarted(
  io: TypedServer,
  room: GameRoom,
  game: Game,
): void {
  const currentPlayer = game.getCurrentPlayer();
  const leaderId = room.getLeaderId() ?? null;

  io.to(socketRoomId(room.code)).emit('gameStarted', {
    roomCode: game.roomCode,
    fragment: game.fragment,
    bombDuration: game.getBombDuration(),
    currentPlayer: currentPlayer.id,
    leaderId,
    players: formatPlayers(game),
  });
}
