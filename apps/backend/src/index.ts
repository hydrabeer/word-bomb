import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import roomsRouter from './routes/rooms';
import { registerRoomHandlers } from './socket/roomHandlers';
import { loadDictionary } from './dictionary';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@game/domain/socket/types';

const app = express();
// Use helmet to set security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", process.env.FRONTEND_URL ?? "http://localhost:5173"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: 'deny' }, // X-Frame-Options: DENY
  }),
);
app.use(cors());

// Sets up an API endpoint for creating and joining rooms
app.use(express.json());
app.use('/api/rooms', roomsRouter);

// eslint-disable-next-line @typescript-eslint/no-misused-promises
const server = createServer(app);
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  never,
  SocketData
>(server, {

// Sets up the Socket.IO server. CORS (Cross-Origin Resource Sharing) just
// lets our backend and our frontend talk to each other from different domains
const io = new Server<ClientToServerEvents, ServerToClientEvents, never, SocketData>(server, {
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

/**
 * Loads the dictionary for validating word submissions and make the server
 * listen on the given port.
 */
async function start(port: string | number) {
  await loadDictionary();

  server.listen(port, () => {
    console.log(`🚀 Server running on port ${port.toString()}`);
  });
}

// Production: use environment variable; Dev: use 3001
const PORT = process.env.PORT ?? 3001;
start(PORT).catch((err: unknown) => {
  console.error('❌ Failed to start app:', err);
  process.exit(1);
});

// When a client connects
io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // Set up the functions that handle socket events
  registerRoomHandlers(io, socket);
});

// Log basic socket events in the main namespace
io.of('/').adapter.on('create-room', (room: string) => {
  if (room.startsWith('room:')) {
    console.log(`📦 [Adapter] created socket.io room: ${room}`);
  }
});

io.of('/').adapter.on('delete-room', (room: string) => {
  if (room.startsWith('room:')) {
    console.log(`🗑️ [Adapter] deleted socket.io room: ${room}`);
  }
});

io.of('/').adapter.on('join-room', (room: string, id: string) => {
  if (room.startsWith('room:')) {
    console.log(`👤 [Adapter] socket ${id} joined ${room}`);
  }
});

io.of('/').adapter.on('leave-room', (room: string, id: string) => {
  if (room.startsWith('room:')) {
    console.log(`👋 [Adapter] socket ${id} left ${room}`);
  }
});
