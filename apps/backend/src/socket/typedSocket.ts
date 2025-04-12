import type { Server as RawServer, Socket as RawSocket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@game/domain/socket/types';

export type TypedServer = RawServer<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = RawSocket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
