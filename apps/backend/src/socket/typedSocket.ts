import type { Server as RawServer, Socket as RawSocket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@word-bomb/types/socket';

/**
 * Socket.IO server configured with the shared client/server event contracts.
 */
export type TypedServer = RawServer<ClientToServerEvents, ServerToClientEvents>;

/**
 * Socket.IO socket instance that enforces the shared event and data payload types.
 */
export type TypedSocket = RawSocket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
