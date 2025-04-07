import express, { Request, Response } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { rooms, Player } from './game';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  },
});

// Helper: Generate a random 4-letter room code.
function generateRoomCode(): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return code;
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Event for joining an existing room.
  socket.on('joinRoom', ({ name, roomCode, userToken }) => {
    let room = rooms.get(roomCode);
    if (!room) {
      // If the room doesn't exist, we create it on-the-fly.
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

    // Check if the user (via their persistent token) is already in the room.
    const existingPlayer = room.players.find(p => p.userToken === userToken);
    if (existingPlayer) {
      // Update their socket id and name if needed.
      existingPlayer.id = socket.id;
      existingPlayer.name = name;
    } else {
      // Create a new player record.
      const newPlayer: Player = {
        id: socket.id,
        name,
        userToken,
        isAlive: true,
      };
      room.players.push(newPlayer);
    }

    socket.join(roomCode);
    // Broadcast the updated room state.
    io.to(roomCode).emit('roomUpdate', room);
  });

  // Event for creating a new room.
  // A callback is provided to return the generated room code to the client.
  socket.on('createRoom', ({ name, roomName, userToken }, callback: (roomCode: string) => void) => {
    let roomCode = "";
    // Ensure we generate a unique 4-letter code.
    do {
      roomCode = generateRoomCode();
    } while (rooms.has(roomCode));

    // Create the new room and optionally store the roomName.
    const room = {
      code: roomCode,
      roomName,
      players: [] as Player[],
      currentTurnIndex: 0,
      usedWords: new Set<string>(),
      fragment: '',
      isPlaying: false,
    };
    rooms.set(roomCode, room);

    // Add the creator as a player.
    const newPlayer: Player = {
      id: socket.id,
      name,
      userToken,
      isAlive: true,
    };
    room.players.push(newPlayer);

    socket.join(roomCode);
    io.to(roomCode).emit('roomUpdate', room);

    // Return the generated room code to the client via the callback.
    if (callback) callback(roomCode);
  });

  // Chat message event: broadcast to the room.
  socket.on('chatMessage', ({ roomCode, name, message }) => {
    const chatMsg = { sender: name, message, timestamp: Date.now() };
    io.to(roomCode).emit('chatMessage', chatMsg);
  });

  // On disconnect, remove the player from any room they were in.
  socket.on('disconnecting', () => {
    for (const roomCode of socket.rooms) {
      // Skip the socket's default room (which is the socket id).
      if (roomCode === socket.id) continue;
      const room = rooms.get(roomCode);
      if (room) {
        room.players = room.players.filter(p => p.id !== socket.id);
        io.to(roomCode).emit('roomUpdate', room);
      }
    }
  });
});

app.get('/', (_: Request, res: Response) => {
  res.send('Server running');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
