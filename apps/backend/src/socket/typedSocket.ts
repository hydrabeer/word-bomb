import { Server as SocketIOServer } from 'socket.io';
import type {
  Server as RawServer,
  Socket as RawSocket,
  ServerOptions,
} from 'socket.io';
import type { Server as HttpServer } from 'http';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  InterServerEvents,
} from '@word-bomb/types/socket';

export type { InterServerEvents } from '@word-bomb/types/socket';

/**
 * Socket.IO server configured with the shared client/server event contracts.
 */
export type TypedServer = RawServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/**
 * Socket.IO socket instance that enforces the shared event and data payload types.
 */
export type TypedSocket = RawSocket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/**
 * Creates a Socket.IO server that respects the shared event contracts.
 */
export function createTypedServer(
  httpServer: HttpServer,
  options?: Partial<ServerOptions>,
): TypedServer {
  return new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, options);
}
