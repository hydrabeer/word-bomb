import type { TypedServer } from '../../socket/typedSocket';
import type { Game } from '@game/domain/game/Game';
import { socketRoomId } from '../../utils/socketRoomId';
import { formatPlayers } from './formatPlayers';

export function broadcastTurnState(
  io: TypedServer,
  roomCode: string,
  game: Game,
): void {
  const payload = {
    playerId: game.getCurrentPlayer().id,
    fragment: game.fragment,
    bombDuration: game.getBombDuration(),
    players: formatPlayers(game),
  };

  io.to(socketRoomId(roomCode)).emit('turnStarted', payload);
}
