import express from 'express';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
  type RequestListener,
} from 'http';
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
} from '@word-bomb/types';

const app = express();
// Use helmet to set security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: [
          "'self'",
          process.env.FRONTEND_URL ?? 'http://localhost:5173',
        ],
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

// Adapter: Express app signature is (req, res, next). Node's createServer expects (req, res).
// We provide a no-op next function and ensure a void return; no ESLint suppression needed.
const nodeHandler: RequestListener = (
  req: IncomingMessage,
  res: ServerResponse,
) => {
  // Cast through unknown to keep strict typing without introducing 'any'.
  (
    app as unknown as (
      req: IncomingMessage,
      res: ServerResponse,
      next: (err?: unknown) => void,
    ) => void
  )(req, res, function next() {
    // Intentionally no-op: Node HTTP server does not use the third argument.
  });
};
const server = createServer(nodeHandler);

// Sets up the Socket.IO server. CORS (Cross-Origin Resource Sharing) just
// lets our backend and our frontend talk to each other from different domains
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  never,
  SocketData
>(server, {
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
