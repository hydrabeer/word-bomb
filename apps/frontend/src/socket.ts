// apps/frontend/src/socket.ts
import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@word-bomb/types/socket';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  BACKEND_URL,
  {
    autoConnect: false,
    transports: ['websocket'],
  },
) as Socket<ServerToClientEvents, ClientToServerEvents>;
