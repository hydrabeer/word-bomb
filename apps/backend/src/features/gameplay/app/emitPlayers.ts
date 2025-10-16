import { GameRoom } from '@game/domain/rooms/GameRoom';
import { computePlayersDiff } from './playersDiffCache';
import { RoomBroadcaster } from '../../../platform/socket/RoomBroadcaster';
import type { TypedServer } from '../../../platform/socket/typedSocket';

/**
 * Broadcasts the latest players list (and diff) for a room to all subscribed clients.
 *
 * @param io - The typed socket server responsible for emissions.
 * @param room - The room whose players should be broadcast.
 */
export function emitPlayers(io: TypedServer, room: GameRoom): void {
  const diff = computePlayersDiff(room);
  new RoomBroadcaster(io).players(room, diff ?? undefined);
}
