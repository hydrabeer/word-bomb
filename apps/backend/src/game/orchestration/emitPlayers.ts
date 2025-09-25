import type { TypedServer } from '../../socket/typedSocket';
import { socketRoomId } from '../../utils/socketRoomId';
import { GameRoom } from '@game/domain/rooms/GameRoom';
import { computePlayersDiff } from './playersDiffCache';

export function emitPlayers(io: TypedServer, room: GameRoom): void {
  const roomCode = room.code;
  const diff = computePlayersDiff(room);
  if (diff) {
    io.to(socketRoomId(roomCode)).emit('playersDiff', diff);
  }
  io.to(socketRoomId(roomCode)).emit('playersUpdated', {
    players: room.getAllPlayers().map((p) => ({
      id: p.id,
      name: p.name,
      isSeated: p.isSeated,
      isConnected: p.isConnected,
    })),
    leaderId: room.getLeaderId() ?? undefined,
  });
}
