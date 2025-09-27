import { GameRoom } from '@game/domain';
import { computePlayersDiff } from './playersDiffCache';
import { RoomBroadcaster } from '../../core/RoomBroadcaster';
import type { TypedServer } from '../../socket/typedSocket';

export function emitPlayers(io: TypedServer, room: GameRoom): void {
  const diff = computePlayersDiff(room);
  new RoomBroadcaster(io).players(room, diff ?? undefined);
}
