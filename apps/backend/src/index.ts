import express, { Request, Response } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { generateRoomCode, getRandomFragment } from './utils/helpers';
import { rooms, Player } from './game';

const app = express();
app.use(cors());

app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  },
});

app.post("/api/joinRoom", (req: Request, res: Response) => {
    const { roomCode } = req.body;

    if (!roomCode) {
      res.status(400).json({
        success: false,
        message: "Missing roomCode"
      });
    }

    const room = rooms.get(roomCode);
    if (!room) {
      res.status(404).json({ success: false, message: "Room not found." });
      return;
    }
    res.status(200).json({ success: true, room });
  }
);


// In-memory rate limiting data for chat messages per user.
const chatTimestamps = new Map<string, number[]>();
const lastSystemMessage = new Map<string, number>();

const RATE_LIMIT_WINDOW = 5000; // 5 seconds
const MESSAGE_THRESHOLD = 10;   // Allow 10 messages per window
const SYSTEM_MESSAGE_INTERVAL = 3000; // 3 seconds between system messages

// Map to keep track of scheduled deletion timers per room.
const deletionTimers = new Map<string, NodeJS.Timeout>();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Event for joining an existing room.
  socket.on('joinRoom', ({ name, roomCode, userToken }) => {
    let room = rooms.get(roomCode);
    if (!room) {
      console.log(`Room ${roomCode} does not exist.`);
      return;
    }

    // If there's a pending deletion timer for this room, cancel it.
    if (deletionTimers.has(roomCode)) {
      clearTimeout(deletionTimers.get(roomCode));
      deletionTimers.delete(roomCode);
    }

    // Check if the user (via their persistent token) is already in the room.
    const existingPlayer = room.playersById.get(userToken);
    if (existingPlayer) {
      // If the existing player's socket is different from the current one, disconnect the old socket.
      if (existingPlayer.id !== socket.id) {
        const oldSocket = io.sockets.sockets.get(existingPlayer.id);
        if (oldSocket) {
          oldSocket.disconnect(true);
        }
      }
      // Update the player's socket id and name.
      existingPlayer.id = socket.id;
    } else {
      // Create a new player record.
      const newPlayer: Player = {
        id: socket.id,
        name,
        userToken,
        isAlive: true,
      };
      room.players.push(newPlayer);
      room.playersById.set(newPlayer.userToken, newPlayer);
    }

    void socket.join(roomCode);
    // Broadcast the updated room state.
    io.to(roomCode).emit('roomUpdate', room);
  });

  // Event for creating a new room.
  // A callback is provided to return the generated room code to the client.
  socket.on('createRoom', ({
                             name,
                             roomName,
                             userToken
                           }, callback: (roomCode: string) => void) => {
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
      playersById: new Map<string, Player>(),
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
    room.playersById.set(newPlayer.userToken, newPlayer);

    void socket.join(roomCode);
    io.to(roomCode).emit('roomUpdate', room);

    // Return the generated room code to the client via the callback.
    if (callback) callback(roomCode);
  });

  socket.on('liveInputUpdate', (payload) => {
    const { roomCode, input } = payload;
    // Broadcast the live input to all clients in the room.
    io.to(roomCode).emit('liveInputUpdate', { input });
  });

  // New event: submitWord for gameplay.
  // Expects payload: { roomCode, word, timeout, userToken }
  socket.on('submitWord', (payload, callback?: (result: {
    success: boolean;
    message?: string
  }) => void) => {
    const { roomCode, word, timeout, userToken } = payload;
    const room = rooms.get(roomCode);
    if (!room) {
      if (callback) callback({ success: false, message: "Room not found." });
      return;
    }
    // Ensure it's the active player's turn.
    const activePlayer = room.players[room.currentTurnIndex];
    if (!activePlayer || activePlayer.userToken !== userToken) {
      if (callback) callback({ success: false, message: "Not your turn." });
      return;
    }
    const now = Date.now();

    if (timeout) {
      activePlayer.isAlive = false;
      io.to(roomCode).emit("chatMessage", {
        sender: "System",
        message: `${activePlayer.name} timed out and is eliminated.`,
        timestamp: now,
      });
    } else {
      // Validate word: it must contain the fragment and not be used before.
      if (!word.includes(room.fragment)) {
        activePlayer.isAlive = false;
        io.to(roomCode).emit("chatMessage", {
          sender: "System",
          message: `${activePlayer.name} submitted an invalid word and is eliminated.`,
          timestamp: now,
        });
      } else if (room.usedWords.has(word.toLowerCase())) {
        activePlayer.isAlive = false;
        io.to(roomCode).emit("chatMessage", {
          sender: "System",
          message: `${activePlayer.name} submitted a repeated word and is eliminated.`,
          timestamp: now,
        });
      } else {
        // Accept the word.
        room.usedWords.add(word.toLowerCase());
        io.to(roomCode).emit("chatMessage", {
          sender: activePlayer.name,
          message: word,
          timestamp: now,
        });
      }
    }

    // Move to next active player:
    let nextIndex = room.currentTurnIndex;
    const playersCount = room.players.length;
    let iterations = 0;
    do {
      nextIndex = (nextIndex + 1) % playersCount;
      iterations++;
      // If we've looped through all players and found none alive, end game.
      if (iterations > playersCount) break;
    } while (!room.players[nextIndex].isAlive);
    room.currentTurnIndex = nextIndex;
    // Choose a new fragment.
    room.fragment = getRandomFragment();
    io.to(roomCode).emit("turnUpdate", {
      isMyTurn: false,
      fragment: room.fragment
    });
    if (callback) callback({ success: true });
  });

  // Chat message event: broadcast to the room.
  socket.on('chatMessage', (payload) => {
    const { roomCode, name, message, userToken } = payload;
    const now = Date.now();

    // Get recent timestamps for this user (or an empty array).
    let timestamps = chatTimestamps.get(userToken) || [];
    // Remove timestamps older than RATE_LIMIT_WINDOW.
    timestamps = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW);

    if (timestamps.length >= MESSAGE_THRESHOLD) {
      // User has exceeded the message threshold.
      const lastMsgTime = lastSystemMessage.get(userToken) || 0;
      if (now - lastMsgTime > SYSTEM_MESSAGE_INTERVAL) {
        io.to(roomCode).emit("chatMessage", {
          sender: "System",
          message: `${name}, you're sending messages too fast. Please slow down.`,
          timestamp: now,
        });
        lastSystemMessage.set(userToken, now);
      }
      // Save the filtered timestamps back and do not broadcast the message.
      chatTimestamps.set(userToken, timestamps);
      return;
    }

    // Otherwise, allow the message:
    timestamps.push(now);
    chatTimestamps.set(userToken, timestamps);

    io.to(roomCode).emit("chatMessage", {
      sender: name,
      message,
      timestamp: now,
    });
  });

  // On disconnect, remove the player from any room they were in.
  socket.on('disconnecting', () => {
    for (const roomCode of socket.rooms) {
      // Skip the socket's default room (which is the socket id).
      if (roomCode === socket.id) continue;
      // Remove the player from the room.

      const room = rooms.get(roomCode);
      if (room) {
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
          room.players = room.players.splice(room.players.indexOf(player), 1);
          room.playersById.delete(player.userToken);
          io.to(roomCode).emit('roomUpdate', room);
        }

        // If the room is now empty, schedule its deletion.
        if (room.players.length === 0) {
          // If a timer already exists, clear it first.
          if (deletionTimers.has(roomCode)) {
            clearTimeout(deletionTimers.get(roomCode));
          }
          const timer = setTimeout(() => {
            const currentRoom = rooms.get(roomCode);
            if (currentRoom && currentRoom.players.length === 0) {
              rooms.delete(roomCode);
              console.log(`Room ${roomCode} deleted due to inactivity.`);
            }
            deletionTimers.delete(roomCode);
          }, 10000);
          deletionTimers.set(roomCode, timer);
        }
      }
    }
  });
});

app.get('/', (_: Request, res: Response) => {
  res.send('Server running');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
