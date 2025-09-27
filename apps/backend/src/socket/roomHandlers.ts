// apps/backend/src/socket/roomHandlers.ts

import { roomManager } from '../room/roomManagerSingleton';
import { ChatMessageSchema } from '@game/domain/chat/ChatMessage';
import { getGameEngine } from '../game/engineRegistry';
import { emitPlayers } from '../game/orchestration/emitPlayers';
import { socketRoomId } from '../utils/socketRoomId';
import { startGameForRoom } from '../game/orchestration/startGameForRoom';
import { noop } from '@game/domain/utils/noop';
import type { Player } from '@game/domain/players/Player';
import type { BasicResponse } from '@word-bomb/types';
import { RoomBroadcaster } from '../core/RoomBroadcaster';
import { GameRulesSchema } from '@game/domain/rooms/GameRoomRules';
import {
  buildGameStartedPayload,
  buildTurnStartedPayload,
} from '../core/serialization';

import type { TypedServer, TypedSocket } from './typedSocket';

// Configurable grace period (ms) before removing a disconnected player.
// Tests may adjust via setDisconnectGrace().
export let DISCONNECT_GRACE_MS = 10000;
export function setDisconnectGrace(ms: number) {
  DISCONNECT_GRACE_MS = ms;
}

export function registerRoomHandlers(io: TypedServer, socket: TypedSocket) {
  // Simple runtime validators to avoid unsafe member access complaints.
  // Generic helpers / parsers (avoid any).
  const isObject = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object';

  interface JoinRoomParsed {
    roomCode: string;
    playerId: string;
    name: string;
  }
  interface LeaveRoomParsed {
    roomCode: string;
    playerId: string;
  }
  interface SetPlayerSeatedParsed {
    roomCode: string;
    playerId: string;
    seated: boolean;
  }
  interface StartGameParsed {
    roomCode: string;
  }
  interface PlayerTypingParsed {
    roomCode: string;
    playerId: string;
    input: string;
  }
  interface SubmitWordParsed {
    roomCode: string;
    playerId: string;
    word: string;
    clientActionId?: string;
  }
  interface UpdateRoomRulesParsed {
    roomCode: string;
    rules: unknown;
  }

  const parseJoinRoom = (raw: unknown): JoinRoomParsed | null => {
    if (!isObject(raw)) return null;
    const { roomCode, playerId, name } = raw;
    if (typeof roomCode !== 'string' || typeof playerId !== 'string')
      return null;
    return { roomCode, playerId, name: typeof name === 'string' ? name : '' };
  };
  const parseLeaveRoom = (raw: unknown): LeaveRoomParsed | null => {
    if (!isObject(raw)) return null;
    const { roomCode, playerId } = raw;
    if (typeof roomCode !== 'string' || typeof playerId !== 'string')
      return null;
    return { roomCode, playerId };
  };
  const parseSetPlayerSeated = (raw: unknown): SetPlayerSeatedParsed | null => {
    if (!isObject(raw)) return null;
    const { roomCode, playerId, seated } = raw;
    if (typeof roomCode !== 'string' || typeof playerId !== 'string')
      return null;
    return { roomCode, playerId, seated: Boolean(seated) };
  };
  const parseStartGame = (raw: unknown): StartGameParsed | null => {
    if (!isObject(raw)) return null;
    const { roomCode } = raw;
    if (typeof roomCode !== 'string') return null;
    return { roomCode };
  };
  const parsePlayerTyping = (raw: unknown): PlayerTypingParsed | null => {
    if (!isObject(raw)) return null;
    const { roomCode, playerId, input } = raw;
    if (typeof roomCode !== 'string' || typeof playerId !== 'string')
      return null;
    return {
      roomCode,
      playerId,
      input: typeof input === 'string' ? input : '',
    };
  };
  const parseSubmitWord = (raw: unknown): SubmitWordParsed | null => {
    if (!isObject(raw)) return null;
    const { roomCode, playerId, word, clientActionId } = raw;
    if (
      typeof roomCode !== 'string' ||
      typeof playerId !== 'string' ||
      typeof word !== 'string'
    )
      return null;
    return {
      roomCode,
      playerId,
      word,
      clientActionId:
        typeof clientActionId === 'string' ? clientActionId : undefined,
    };
  };
  const parseUpdateRoomRules = (raw: unknown): UpdateRoomRulesParsed | null => {
    if (!isObject(raw)) return null;
    const { roomCode, rules } = raw;
    if (typeof roomCode !== 'string') return null;
    return { roomCode, rules };
  };
  const broadcaster = new RoomBroadcaster(io);

  function normalizeCb(cb: unknown): (res: BasicResponse) => void {
    return typeof cb === 'function'
      ? (cb as (res: BasicResponse) => void)
      : noop;
  }

  function system(roomCode: string, message: string) {
    broadcaster.systemMessage(roomCode, message);
  }

  const getCurrentRoomCode = (): string | undefined => {
    const data: unknown = socket.data;
    if (data && typeof data === 'object' && 'currentRoomCode' in data) {
      const val = (data as { currentRoomCode?: unknown }).currentRoomCode;
      return typeof val === 'string' ? val : undefined;
    }
    return undefined;
  };

  const setCurrentRoomCode = (code: string): void => {
    // socket.data is typed structurally, guard anyway
    (socket.data as { currentRoomCode?: string }).currentRoomCode = code;
  };

  const getCurrentPlayerId = (): string | undefined => {
    const data: unknown = socket.data;
    if (data && typeof data === 'object' && 'currentPlayerId' in data) {
      const val = (data as { currentPlayerId?: unknown }).currentPlayerId;
      return typeof val === 'string' ? val : undefined;
    }
    return undefined;
  };
  const setCurrentPlayerId = (playerId: string): void => {
    (socket.data as { currentPlayerId?: string }).currentPlayerId = playerId;
  };

  function handleJoinRoom(raw: unknown, cb?: (res: BasicResponse) => void) {
    const callback = normalizeCb(cb);
    const parsed = parseJoinRoom(raw);
    if (!parsed) {
      callback({ success: false, error: 'Invalid payload' });
      return;
    }
    const { roomCode, playerId, name } = parsed;
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
      const existing = getCurrentRoomCode();
      if (existing !== roomCode) {
        const prevRoom = existing;
        if (prevRoom && prevRoom !== roomCode) {
          const old = roomManager.get(prevRoom);
          if (old?.hasPlayer(playerId)) {
            const oldName = old.getPlayer(playerId)?.name ?? 'Someone';
            old.removePlayer(playerId);
            emitPlayers(io, old);
            system(prevRoom, `${oldName} left the room.`);
          }
          // If player wasn't in prevRoom, suppress any leave announcement.
          void socket.leave(socketRoomId(prevRoom));
          console.log(`[JOIN ROOM] Socket ${socket.id} left room:${prevRoom}`);
        }
        setCurrentRoomCode(roomCode);
        void socket.join(socketRoomId(roomCode));
        console.log(`[JOIN ROOM] Socket ${socket.id} joined room:${roomCode}`);
      }
      if (!room.hasPlayer(playerId)) {
        room.addPlayer({ id: playerId, name });
        system(roomCode, `${name} joined the room.`);
        emitPlayers(io, room);
      } else {
        room.setPlayerConnected(playerId, true);
        emitPlayers(io, room);
      }
      setCurrentPlayerId(playerId);

      // If a game is already in progress, immediately emit the current game
      // snapshot so late joiners become spectators. They are NOT added to the
      // active game.player list (only seated-at-start players are). We send
      // both gameStarted and a synthetic turnStarted so the client sets up
      // timers/UI. (The bomb timer will show full duration remaining for the
      // current turn; improving this with remaining time would require a
      // protocol change and engine time tracking.)
      if (room.game) {
        try {
          const game = room.game;
          socket.emit('gameStarted', buildGameStartedPayload(room, game));
          socket.emit('turnStarted', buildTurnStartedPayload(game));
        } catch (e) {
          console.warn(
            '[JOIN ROOM] Failed to emit existing game state to late joiner:',
            e,
          );
        }
      }

      const { bonusTemplate, ...restRules } = room.rules;
      socket.emit('roomRulesUpdated', {
        roomCode,
        rules: {
          ...restRules,
          bonusTemplate: [...bonusTemplate],
        },
      });

      callback({ success: true });
    } catch (err) {
      console.error('[JOIN ROOM] Error:', err);
      callback({ success: false, error: (err as Error).message });
    }
  }
  socket.on('joinRoom', handleJoinRoom);

  // leaveRoom event
  function handleLeaveRoom(raw: unknown) {
    const parsed = parseLeaveRoom(raw);
    if (!parsed) return;
    const { roomCode, playerId } = parsed;
    console.log(
      `[LEAVE ROOM] socketId=${socket.id}, playerId=${playerId}, roomCode=${roomCode}`,
    );
    const room = roomManager.get(roomCode);
    if (!room) return;
    // Only announce/act if this player is actually in the room.
    const player = room.getPlayer(playerId);
    if (!player) {
      // Ignore stray leave events (e.g., race conditions from route changes).
      return;
    }
    const playerName = player.name;
    room.removePlayer(playerId);

    void socket.leave(socketRoomId(roomCode));
    emitPlayers(io, room);
    system(roomCode, `${playerName} left the room.`);
  }
  socket.on('leaveRoom', handleLeaveRoom);

  // chatMessage event
  socket.on('chatMessage', (raw: unknown) => {
    if (!isObject(raw)) return;
    const rec: Record<string, unknown> = isObject(raw) ? raw : {};
    const candidate = {
      ...rec,
      timestamp: Date.now(),
      type: typeof rec.type === 'string' ? rec.type : 'user',
    };
    const result = ChatMessageSchema.safeParse(candidate);
    if (!result.success) {
      console.warn('[CHAT] Invalid message:', result.error);
      return;
    }
    const chatMessage = result.data;
    io.to(socketRoomId(chatMessage.roomCode)).emit('chatMessage', chatMessage);
  });

  // setPlayerSeated event
  function handleSetPlayerSeated(
    raw: unknown,
    cb?: (res: BasicResponse) => void,
  ) {
    const callback = normalizeCb(cb);
    const parsed = parseSetPlayerSeated(raw);
    if (!parsed) {
      callback({ success: false, error: 'Invalid payload' });
      return;
    }
    const { roomCode, playerId, seated } = parsed;
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
        io.to(socketRoomId(roomCode)).emit('gameCountdownStarted', {
          deadline,
        });
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
  }
  socket.on('setPlayerSeated', handleSetPlayerSeated);

  // startGame event
  function handleStartGame(raw: unknown, cb?: (res: BasicResponse) => void) {
    const callback = normalizeCb(cb);
    const parsed = parseStartGame(raw);
    if (!parsed) {
      callback({ success: false, error: 'Invalid payload' });
      return;
    }
    const { roomCode } = parsed;
    console.log(`[GAME START] Attempting to start game in room ${roomCode}`);
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
  }
  socket.on('startGame', handleStartGame);

  function handlePlayerTyping(raw: unknown) {
    const parsed = parsePlayerTyping(raw);
    if (!parsed) return;
    const { roomCode, playerId, input } = parsed;
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
  }
  socket.on('playerTyping', handlePlayerTyping);

  // submitWord event
  function handleSubmitWord(raw: unknown, cb?: (res: BasicResponse) => void) {
    const callback = normalizeCb(cb);
    const parsed = parseSubmitWord(raw);
    if (!parsed) {
      callback({ success: false, error: 'Invalid payload' });
      return;
    }
    const { roomCode, playerId, word, clientActionId } = parsed;
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
  }
  socket.on('submitWord', handleSubmitWord);

  function handleUpdateRoomRules(
    raw: unknown,
    cb?: (res: BasicResponse) => void,
  ) {
    const callback = normalizeCb(cb);
    const parsed = parseUpdateRoomRules(raw);
    if (!parsed) {
      callback({ success: false, error: 'Invalid payload' });
      return;
    }
    const { roomCode, rules } = parsed;
    const room = roomManager.get(roomCode);
    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }
    const playerId = getCurrentPlayerId();
    if (!playerId) {
      callback({ success: false, error: 'Player not recognized' });
      return;
    }
    if (room.getLeaderId() !== playerId) {
      callback({ success: false, error: 'Only the leader can change rules.' });
      return;
    }
    const validation = GameRulesSchema.safeParse(rules);
    if (!validation.success) {
      const firstIssue = validation.error.issues[0];
      callback({
        success: false,
        error: firstIssue?.message ?? 'Invalid rules provided',
      });
      return;
    }
    try {
      room.updateRules(validation.data);
      broadcaster.rules(room);
      const leaderName = room.getPlayer(playerId)?.name ?? 'Leader';
      system(roomCode, `${leaderName} updated the room rules.`);
      callback({ success: true });
    } catch (error) {
      callback({ success: false, error: (error as Error).message });
    }
  }
  socket.on('updateRoomRules', handleUpdateRoomRules);

  // disconnect event
  socket.on('disconnect', () => {
    const roomCode = getCurrentRoomCode();
    if (!roomCode) return;
    const room = roomManager.get(roomCode);
    if (!room) return;
    const playerId = getCurrentPlayerId();
    if (!playerId) return; // player never completed join
    // Instead of removing immediately, mark disconnected to allow reconnection window
    if (room.hasPlayer(playerId)) {
      room.setPlayerConnected(playerId, false);
      emitPlayers(io, room);
      const playerName = room.getPlayer(playerId)?.name ?? 'A player';
      system(
        roomCode,
        `${playerName} disconnected (will be removed if not back soon).`,
      );
      console.log(
        `❌ [DISCONNECT] player ${playerId} marked disconnected in room ${roomCode}`,
      );
      // schedule removal if not reconnected after timeout
      setTimeout(() => {
        const stillRoom = roomManager.get(roomCode);
        if (!stillRoom) return;
        const p = stillRoom.getPlayer(playerId);
        if (p && !p.isConnected) {
          const name = p.name;
          stillRoom.removePlayer(playerId);
          emitPlayers(io, stillRoom);
          system(roomCode, `${name} removed due to inactivity.`);
        }
      }, DISCONNECT_GRACE_MS); // grace period
    }
  });

  // Enhance joinRoom to treat existing disconnected player as reconnect
  // (Patch inserted near top of handler inside existing joinRoom listener)
}
