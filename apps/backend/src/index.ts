import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import roomsRouter from './routes/rooms';
import { registerRoomHandlers } from './socket/roomHandlers';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@game/domain/socket/types';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/rooms', roomsRouter);

// eslint-disable-next-line @typescript-eslint/no-misused-promises
const server = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, never, SocketData>(server, {
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  registerRoomHandlers(io, socket);
});

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

const PORT = process.env.PORT ?? 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT.toString()}`);
});
