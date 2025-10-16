import { roomManager } from '@rooms/app/roomManagerSingleton';
import { deleteGameEngine } from '@gameplay/engine/engineRegistry';
import { removePlayersDiffCacheForRoom } from '@gameplay/app/playersDiffCache';
import { RoomBroadcaster } from '@backend/platform/socket/RoomBroadcaster';
import { SocketSession } from '@platform/socket/socketSession';
import { getLogger } from '@platform/logging/context';
import type { GameRoom } from '@game/domain/rooms/GameRoom';
import type { TypedServer, TypedSocket } from '@platform/socket/typedSocket';

/**
 * Shared dependencies and helpers used by the room socket event handlers.
 */
export interface RoomHandlerContext {
  /** Shared Socket.IO server instance. */
  readonly io: TypedServer;
  /** Socket representing the connected client. */
  readonly socket: TypedSocket;
  /** Session abstraction used to persist socket scoped metadata. */
  readonly session: SocketSession;
  /** Utility broadcaster for common room events. */
  readonly broadcaster: RoomBroadcaster;
  /**
   * Emits a system chat message to every player in the provided room.
   *
   * @param roomCode - Identifier of the room receiving the message.
   * @param message - Human friendly text describing the event.
   */
  readonly system: (roomCode: string, message: string) => void;
  /**
   * Removes the room from memory when no players remain connected.
   *
   * @param roomCode - Identifier for the room being checked.
   */
  readonly cleanupRoomIfEmpty: (roomCode: string) => void;
}

/**
 * Builds a {@link RoomHandlerContext} for a socket connection.
 *
 * @param io - Shared Socket.IO server instance.
 * @param socket - The socket representing the connected client.
 * @returns A reusable context consumed by the individual event handlers.
 */
export function createRoomHandlerContext(
  io: TypedServer,
  socket: TypedSocket,
): RoomHandlerContext {
  const broadcaster = new RoomBroadcaster(io);
  const session = new SocketSession(socket);

  const system = (roomCode: string, message: string) => {
    broadcaster.systemMessage(roomCode, message);
  };

  const disposeRoom = (roomCode: string, roomInstance: GameRoom) => {
    try {
      roomInstance.cancelGameStartTimer();
    } catch (err) {
      getLogger().warn(
        { event: 'room_cleanup_failed', gameId: roomCode, err },
        'Failed to cancel game start timer',
      );
    }
    deleteGameEngine(roomCode);
    removePlayersDiffCacheForRoom(roomCode);
    roomManager.delete(roomCode);
    getLogger().info(
      { event: 'room_disposed', gameId: roomCode },
      'Disposed empty room',
    );
  };

  const cleanupRoomIfEmpty = (roomCode: string) => {
    const maybeRoom = roomManager.get(roomCode);
    if (!maybeRoom) return;
    if (maybeRoom.getAllPlayers().length > 0) return;
    disposeRoom(roomCode, maybeRoom);
  };

  return {
    io,
    socket,
    session,
    broadcaster,
    system,
    cleanupRoomIfEmpty,
  };
}
