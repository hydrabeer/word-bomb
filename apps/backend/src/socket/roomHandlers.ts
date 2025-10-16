import { getLogContext, runWithContext } from '../logging/context';
import type { TypedServer, TypedSocket } from './typedSocket';
import { createRoomHandlerContext } from './roomHandlers/roomHandlerContext';
import { createRoomEventHandlers } from './roomHandlers/roomEventHandlers';

export { DISCONNECT_GRACE_MS, setDisconnectGrace } from './roomHandlers/disconnectGrace';

/**
 * Registers all room-related Socket.IO handlers for a newly connected client.
 *
 * @param io - Shared typed server instance.
 * @param socket - The socket representing the connected client.
 */
export function registerRoomHandlers(io: TypedServer, socket: TypedSocket): void {
  const connectionContext = getLogContext();
  const withContext =
    <Args extends unknown[]>(handler: (...args: Args) => void) =>
    (...args: Args) => {
      runWithContext(connectionContext, () => {
        handler(...args);
      });
    };

  const context = createRoomHandlerContext(io, socket);
  const handlers = createRoomEventHandlers(context);

  socket.on('joinRoom', withContext(handlers.joinRoom));
  socket.on('leaveRoom', withContext(handlers.leaveRoom));
  socket.on('chatMessage', withContext(handlers.chatMessage));
  socket.on('setPlayerSeated', withContext(handlers.setPlayerSeated));
  socket.on('startGame', withContext(handlers.startGame));
  socket.on('playerTyping', withContext(handlers.playerTyping));
  socket.on('submitWord', withContext(handlers.submitWord));
  socket.on('updateRoomRules', withContext(handlers.updateRoomRules));
  socket.on('disconnect', withContext(handlers.disconnect));
}
