// apps/backend/src/socket/roomHandlers.ts

import { roomManager } from '../room/roomManagerSingleton';
import { ChatMessageSchema } from '@game/domain/chat/ChatMessage';
import { getGameEngine } from '../game/engineRegistry';
import { emitPlayers } from '../game/orchestration/emitPlayers';
import { socketRoomId } from '../utils/socketRoomId';
import { startGameForRoom } from '../game/orchestration/startGameForRoom';
import { noop } from '@game/domain/utils/noop';
import type { Player } from '@game/domain/players/Player';

import type { TypedServer, TypedSocket } from './typedSocket';

// Configurable grace period (ms) before removing a disconnected player.
// Tests may adjust via setDisconnectGrace().
export let DISCONNECT_GRACE_MS = 10000;
export function setDisconnectGrace(ms: number) {
  DISCONNECT_GRACE_MS = ms;
}

export function registerRoomHandlers(io: TypedServer, socket: TypedSocket) {
  // joinRoom event
  socket.on('joinRoom', (data, cb) => {
    const callback = typeof cb === 'function' ? cb : noop;
    const { roomCode, playerId, name } = data;

    if (!name || name.length > 20) {
      console.log(
        `[JOIN ROOM] Invalid name for playerId=${playerId}, name='${name}'`,
      );
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
          // Remove player entity from previous room when switching rooms
          const old = roomManager.get(prevRoom);
          if (old?.hasPlayer(playerId)) {
            const oldName = old.getPlayer(playerId)?.name ?? 'Someone';
            old.removePlayer(playerId);
            emitPlayers(io, old);
            io.to(socketRoomId(prevRoom)).emit('chatMessage', {
              roomCode: prevRoom,
              sender: 'System',
              message: `${oldName} left the room.`,
              timestamp: Date.now(),
              type: 'system',
            });
          }
          void socket.leave(socketRoomId(prevRoom));
          console.log(`[JOIN ROOM] Socket ${socket.id} left room:${prevRoom}`);
        }
        socket.data.currentRoomCode = roomCode;
        void socket.join(socketRoomId(roomCode));
        console.log(`[JOIN ROOM] Socket ${socket.id} joined room:${roomCode}`);
      }

      if (!room.hasPlayer(playerId)) {
        room.addPlayer({ id: playerId, name });
        io.to(socketRoomId(roomCode)).emit('chatMessage', {
          roomCode,
          sender: 'System',
          message: `${name} joined the room.`,
          timestamp: Date.now(),
          type: 'system',
        });
        emitPlayers(io, room);
      } else {
        // Reconnection path
        room.setPlayerConnected(playerId, true);
        emitPlayers(io, room);
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
    console.log(
      `[LEAVE ROOM] socketId=${socket.id}, playerId=${playerId}, roomCode=${roomCode}`,
    );
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
    emitPlayers(io, room);
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

    const seatedPlayers = room
      .getAllPlayers()
      .filter((p: Player) => p.isSeated);
    if (seatedPlayers.length >= 2) {
      if (!room.isGameTimerRunning()) {
        const timeLeft = 15000;
        const deadline = Date.now() + timeLeft;
        room.startGameStartTimer(() => {
          try {
            startGameForRoom(io, room);
          } catch (err) {
            console.error('[AUTO START] Error starting game:', err);
          }
        }, timeLeft);
        io.to(socketRoomId(roomCode)).emit('gameCountdownStarted', { deadline });
      }
    } else {
      // Only emit countdownStopped if a timer was actually running to avoid duplicate stop events.
      if (room.isGameTimerRunning()) {
        room.cancelGameStartTimer();
        io.to(socketRoomId(roomCode)).emit('gameCountdownStopped');
      }
    }
    emitPlayers(io, room);
    callback({ success: true });
  });

  // startGame event
  socket.on('startGame', (data, cb) => {
    const { roomCode } = data;
    console.log(`[GAME START] Attempting to start game in room ${roomCode}`);
    const callback = typeof cb === 'function' ? cb : noop;
    const room = roomManager.get(roomCode);
    if (!room) {
      console.log(`[START GAME] Room not found: ${roomCode}`);
      callback({ success: false, error: 'Room not found' });
      return;
    }
    try {
      const seatedPlayers = room
        .getAllPlayers()
        .filter((p: Player) => p.isSeated);
      if (seatedPlayers.length < 2) {
        console.log(
          '[START GAME] Need at least 2 seated players to start the game.',
        );
        callback({
          success: false,
          error: 'Need at least 2 seated players to start the game.',
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

  socket.on('playerTyping', (data) => {
    const { roomCode, playerId, input } = data;
    const room = roomManager.get(roomCode);
    if (!room?.game) return;

    // Optionally validate that it's their turn
    const currentPlayer = room.game.getCurrentPlayer();
    if (currentPlayer.id !== playerId) return;

    // Broadcast to all players in the room
    io.to(socketRoomId(roomCode)).emit('playerTypingUpdate', {
      playerId,
      input,
    });
  });

  // submitWord event
  socket.on('submitWord', (data, cb) => {
    const callback = typeof cb === 'function' ? cb : noop;
    const { roomCode, playerId, word, clientActionId } = data;
    const room = roomManager.get(roomCode);
    if (!room) {
      callback({ success: false, error: 'Room not found' });
      if (clientActionId) {
        socket.emit('actionAck', {
          clientActionId,
          success: false,
          error: 'Room not found',
        });
      }
      return;
    }

    const engine = getGameEngine(roomCode);
    if (!engine) {
      console.warn(`[SUBMIT] No engine for room ${roomCode}`);
      callback({ success: false, error: 'Game engine not running.' });
      if (clientActionId) {
        socket.emit('actionAck', {
          clientActionId,
          success: false,
          error: 'Game engine not running.',
        });
      }
      return;
    }
    const result = engine.submitWord(playerId, word);
    callback(result);
    if (clientActionId) {
      socket.emit('actionAck', {
        clientActionId,
        success: result.success,
        error: result.success ? undefined : result.error,
      });
    }
  });

  // disconnect event
  socket.on('disconnect', () => {
    const roomCode = socket.data.currentRoomCode;
    if (!roomCode) return;
    const room = roomManager.get(roomCode);
    if (!room) return;
    const playerId = socket.id;
    // Instead of removing immediately, mark disconnected to allow reconnection window
    if (room.hasPlayer(playerId)) {
      room.setPlayerConnected(playerId, false);
      emitPlayers(io, room);
      const playerName = room.getPlayer(playerId)?.name ?? 'A player';
      io.to(socketRoomId(roomCode)).emit('chatMessage', {
        roomCode,
        sender: 'System',
        message: `${playerName} disconnected (will be removed if not back soon).`,
        timestamp: Date.now(),
        type: 'system',
      });
      console.log(`❌ [DISCONNECT] player ${playerId} marked disconnected in room ${roomCode}`);
      // schedule removal if not reconnected after timeout
      setTimeout(() => {
        const stillRoom = roomManager.get(roomCode);
        if (!stillRoom) return;
        const p = stillRoom.getPlayer(playerId);
        if (p && !p.isConnected) {
          const name = p.name;
          stillRoom.removePlayer(playerId);
          emitPlayers(io, stillRoom);
          io.to(socketRoomId(roomCode)).emit('chatMessage', {
            roomCode,
            sender: 'System',
            message: `${name} removed due to inactivity.`,
            timestamp: Date.now(),
            type: 'system',
          });
        }
      }, DISCONNECT_GRACE_MS); // grace period
    }
  });

  // Enhance joinRoom to treat existing disconnected player as reconnect
  // (Patch inserted near top of handler inside existing joinRoom listener)
}
