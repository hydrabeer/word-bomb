import express, { Request, Response } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { rooms, Player } from './game';
import cors from 'cors';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://word-bomb.pages.dev/",
    methods: ["GET", "POST"]
  },
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('joinRoom', ({ name, roomCode }) => {
    let room = rooms.get(roomCode);

    if (!room) {
      room = {
        code: roomCode,
        players: [],
        currentTurnIndex: 0,
        usedWords: new Set(),
        fragment: '',
        isPlaying: false,
      };
      rooms.set(roomCode, room);
    }

    const player: Player = {
      id: socket.id,
      name,
      isAlive: true,
    };

    // Avoid duplicate players (e.g. refresh)
    if (!room.players.find(p => p.id === socket.id)) {
      room.players.push(player);
    }

    socket.join(roomCode);

    // Broadcast updated room state
    io.to(roomCode).emit('roomUpdate', room);
  });

  socket.on('chatMessage', ({ roomCode, name, message }) => {
    const chatMsg = { sender: name, message, timestamp: Date.now() };
    io.to(roomCode).emit('chatMessage', chatMsg);
  });

  socket.on('disconnecting', () => {
    for (const roomCode of socket.rooms) {
      const room = rooms.get(roomCode);
      if (room) {
        // Remove player
        room.players = room.players.filter(p => p.id !== socket.id);

        // Broadcast updated room
        io.to(roomCode).emit('roomUpdate', room);
      }
    }
  });
});

app.get('/', (_: Request, res: Response) => {
  res.send('Server running');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT);
