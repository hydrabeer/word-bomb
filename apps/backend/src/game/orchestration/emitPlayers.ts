import type { TypedServer } from '../../socket/typedSocket';
import { socketRoomId } from '../../utils/socketRoomId';
import { GameRoom } from '@game/domain/rooms/GameRoom';

export function emitPlayers(io: TypedServer, room: GameRoom): void {
  const roomCode = room.code;
  io.to(socketRoomId(roomCode)).emit('playersUpdated', {
    players: room.getAllPlayers().map((p) => ({
      id: p.id,
      name: p.name,
      isSeated: p.isSeated,
    })),
    leaderId: room.getLeaderId() ?? undefined,
  });
}
