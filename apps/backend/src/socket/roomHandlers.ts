// apps/backend/src/socket/roomHandlers.ts

import { roomManager } from '../room/roomManagerSingleton';
import { createPlayer } from '@game/domain/players/createPlayer';
import { ChatMessageSchema } from '@game/domain/chat/ChatMessage';
import { noop } from '@game/domain/utils/noop';
import { Game } from '@game/domain/game/Game';
import type { Server, Socket } from 'socket.io';
import type { Player } from '@game/domain/players/Player';
import type { GameRoom } from '@game/domain/rooms/GameRoom';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@game/domain/socket/types';

// Convert a room code into the Socket.IO room name.
function socketRoomId(code: string): string {
  return `room:${code}`;
}

function emitPlayers(io: Server, roomCode: string) {
  const room = roomManager.get(roomCode);
  if (!room) return;
  io.to(socketRoomId(roomCode)).emit('playersUpdated', {
    players: room.getAllPlayers().map((p) => ({
      id: p.id,
      name: p.name,
      isSeated: p.isSeated,
    })),
  });
}

// A helper to format players for broadcast.
function formatPlayers(game: Game) {
  return game.players.map((p: Player) => ({
    id: p.id,
    name: p.name,
    isEliminated: p.isEliminated,
    lives: p.lives,
  }));
}

function startGameForRoom(io: Server, room: GameRoom) {
  // Mark the room as playing and reset each player's status.
  room.startGame();

  const game = new Game({
    roomCode: room.code,
    players: room.getAllPlayers(),
    currentTurnIndex: 0,
    fragment: 'ab', // Randomize this later if desired.
    bombDuration: 10,
    state: 'active',
    rules: room.rules,
  });
  room.game = game;

  io.to(socketRoomId(room.code)).emit('gameStarted', {
    roomCode: game.roomCode,
    fragment: game.fragment,
    bombDuration: game.bombDuration,
    currentPlayer: game.getCurrentPlayer()?.id ?? null,
    leaderId: room.getLeaderId(),
    players: formatPlayers(game),
  });
}

function broadcastTurnState(io: Server, roomCode: string, game: Game) {
  console.log(
    `[BROADCAST TURN STATE] roomCode=${roomCode}, nextPlayer=${game.getCurrentPlayer()?.id ?? 'none'}`,
  );
  io.to(socketRoomId(roomCode)).emit('turnStarted', {
    playerId: game.getCurrentPlayer()?.id ?? null,
    fragment: game.fragment,
    bombDuration: game.bombDuration,
    players: formatPlayers(game),
  });
}

function checkGameOver(io: Server, roomCode: string) {
  const room = roomManager.get(roomCode);
  if (!room?.game) return;

  const { game } = room;
  const activePlayers = game.players.filter((p: Player) => !p.isEliminated);

  if (activePlayers.length === 1) {
    const winnerId = activePlayers[0].id;
    console.log(`[GAME OVER] roomCode=${roomCode}, winnerId=${winnerId}`);
    io.to(socketRoomId(roomCode)).emit('gameEnded', { winnerId });
    room.endGame(); // Switch room state back (e.g., "seating")
    room.game = undefined;
  }
}

export function registerRoomHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, never, SocketData>,
) {
  // joinRoom event
  socket.on('joinRoom', (data, cb) => {
    const callback = typeof cb === 'function' ? cb : noop;
    const { roomCode, playerId, name } = data;

    if (!name || name.length > 20) {
      console.log(`[JOIN ROOM] Invalid name for playerId=${playerId}, name='${name}'`);
      callback({ success: false, error: 'Invalid player name' });
      return;
    }

    const room = roomManager.get(roomCode);
    if (!room) {
      console.log(`[JOIN ROOM] Room not found: ${roomCode}`);
      callback({ success: false, error: 'Room not found' });
      return;
    }

    try {
      // Check if we're not already in the same room.
      if (socket.data.currentRoomCode !== roomCode) {
        const prevRoom = socket.data.currentRoomCode;
        if (prevRoom && prevRoom !== roomCode) {
          void socket.leave(socketRoomId(prevRoom));
          console.log(`[JOIN ROOM] Socket ${socket.id} left room:${prevRoom}`);
        }
        socket.data.currentRoomCode = roomCode;
        void socket.join(socketRoomId(roomCode));
        console.log(`[JOIN ROOM] Socket ${socket.id} joined room:${roomCode}`);
      }

      if (!room.hasPlayer(playerId)) {
        const player = createPlayer({
          props: {
            id: playerId,
            name,
            isLeader: false,
            isSeated: false,
            isEliminated: false,
            lives: room.rules.maxLives,
          },
          bonusTemplate: room.rules.bonusTemplate,
        });
        console.log(
          `[JOIN ROOM] Adding new player '${player.name}' (${player.id}) to room ${roomCode}`,
        );
        room.addPlayer(player);

        io.to(socketRoomId(roomCode)).emit('chatMessage', {
          roomCode,
          sender: 'System',
          message: `${name} joined the room.`,
          timestamp: Date.now(),
          type: 'system',
        });

        emitPlayers(io, roomCode);
      }

      callback({ success: true });
    } catch (err) {
      console.error('[JOIN ROOM] Error:', err);
      callback({ success: false, error: (err as Error).message });
    }
  });

  // leaveRoom event
  socket.on('leaveRoom', (data) => {
    const { roomCode, playerId } = data;
    console.log(`[LEAVE ROOM] socketId=${socket.id}, playerId=${playerId}, roomCode=${roomCode}`);
    const room = roomManager.get(roomCode);
    if (!room) return;
    room.removePlayer(playerId);
    const playerName = room.getPlayer(playerId)?.name ?? 'Someone';
    io.to(socketRoomId(roomCode)).emit('chatMessage', {
      roomCode,
      sender: 'System',
      message: `${playerName} left the room.`,
      timestamp: Date.now(),
      type: 'system',
    });

    void socket.leave(socketRoomId(roomCode));
    emitPlayers(io, roomCode);
  });

  // chatMessage event
  socket.on('chatMessage', (data) => {
    const result = ChatMessageSchema.safeParse({
      ...data,
      timestamp: Date.now(),
      type: data.type ?? 'user',
    });
    if (!result.success) {
      console.warn('[CHAT] Invalid message:', result.error);
      return;
    }
    const chatMessage = result.data;
    console.log(`[CHAT] Broadcasting message in roomCode=${chatMessage.roomCode}`);
    io.to(socketRoomId(chatMessage.roomCode)).emit('chatMessage', chatMessage);
  });

  // setPlayerSeated event
  socket.on('setPlayerSeated', (data, cb) => {
    const callback = typeof cb === 'function' ? cb : noop;
    const { roomCode, playerId, seated } = data;
    const room = roomManager.get(roomCode);
    if (!room) {
      console.log('[SET SEATED] Room not found:', roomCode);
      callback({ success: false, error: 'Room not found' });
      return;
    }

    room.setPlayerSeated(playerId, seated);
    console.log(`[SET SEATED] Updated seating for playerId=${playerId} to ${String(seated)}`);

    const seatedPlayers = room.getAllPlayers().filter((p: Player) => p.isSeated);
    if (seatedPlayers.length >= 2) {
      if (!room.isGameTimerRunning()) {
        const timeLeft = 15000;
        const deadline = Date.now() + timeLeft;
        room.startGameStartTimer(() => {
          console.log(`[AUTO START] Timer expired for roomCode=${roomCode}`);
          try {
            startGameForRoom(io, room);
          } catch (err) {
            console.error('[AUTO START] Error starting game:', err);
          }
        }, timeLeft);
        io.to(socketRoomId(roomCode)).emit('gameCountdownStarted', { deadline });
        console.log(
          `[SET SEATED] Started game timer for roomCode=${roomCode}, deadline=${deadline.toString()}`,
        );
      }
    } else {
      room.cancelGameStartTimer();
      io.to(socketRoomId(roomCode)).emit('gameCountdownStopped');
    }
    emitPlayers(io, roomCode);
    callback({ success: true });
  });

  // startGame event
  socket.on('startGame', (data, cb) => {
    const callback = typeof cb === 'function' ? cb : noop;
    const { roomCode } = data;
    const room = roomManager.get(roomCode);
    if (!room) {
      console.log(`[START GAME] Room not found: ${roomCode}`);
      callback({ success: false, error: 'Room not found' });
      return;
    }
    try {
      const players = room.getAllPlayers();
      if (players.length < 2) {
        console.log('[START GAME] Need at least 2 players to start the game.');
        callback({
          success: false,
          error: 'Need at least 2 players to start the game.',
        });
        return;
      }
      room.cancelGameStartTimer();
      startGameForRoom(io, room);
      callback({ success: true });
    } catch (err) {
      console.error('[START GAME] Error:', err);
      callback({ success: false, error: (err as Error).message });
    }
  });

  // submitWord event
  socket.on('submitWord', (data, cb) => {
    const callback = typeof cb === 'function' ? cb : noop;
    const { roomCode, playerId, word } = data;
    const room = roomManager.get(roomCode);
    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }
    if (!room.game) {
      callback({
        success: false,
        error: 'Game not in progress',
      });
      return;
    }

    const game = room.game;
    const currentPlayer = game.getCurrentPlayer();
    if (!currentPlayer) {
      callback({
        success: false,
        error: 'No current player.',
      });
      return;
    }
    if (currentPlayer.id !== playerId) {
      callback({
        success: false,
        error: 'Not your turn.',
      });
      return;
    }

    if (!word || word.trim().length < 2) {
      currentPlayer.loseLife();
      io.to(socketRoomId(roomCode)).emit('playerUpdated', {
        playerId,
        lives: currentPlayer.lives,
      });
      game.nextTurn();
      broadcastTurnState(io, roomCode, game);
      checkGameOver(io, roomCode);
      callback({ success: false, error: 'Invalid word (too short).' });
      return;
    }

    if (!word.toLowerCase().includes(game.fragment.toLowerCase())) {
      currentPlayer.loseLife();
      io.to(socketRoomId(roomCode)).emit('playerUpdated', {
        playerId,
        lives: currentPlayer.lives,
      });
      game.nextTurn();
      broadcastTurnState(io, roomCode, game);
      checkGameOver(io, roomCode);
      callback({
        success: false,
        error: "Word doesn't contain the fragment.",
      });
      return;
    }

    io.to(socketRoomId(roomCode)).emit('wordAccepted', { playerId, word });
    game.nextTurn();
    broadcastTurnState(io, roomCode, game);
    checkGameOver(io, roomCode);
    callback({ success: true });
  });

  // disconnect event
  socket.on('disconnect', () => {
    console.log(`❌ [DISCONNECT] socketId=${socket.id} disconnected`);
  });
}
