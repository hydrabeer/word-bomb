// apps/backend/src/socket/roomHandlers.ts

import { roomManager } from '../room/roomManagerSingleton';
import { toAuthoritativeChatMessage } from '@game/domain/chat/ChatMessage';
import { GameRulesSchema } from '@game/domain/rooms/GameRoomRules';
import { noop } from '@game/domain/utils/noop';
import { GameRoom } from '@game/domain/rooms/GameRoom';
import { getGameEngine } from '../game/engineRegistry';
import { emitPlayers } from '../game/orchestration/emitPlayers';
import { socketRoomId } from '../utils/socketRoomId';
import { startGameForRoom } from '../game/orchestration/startGameForRoom';
import type { Player } from '@game/domain/players/Player';
import type { BasicResponse } from '@word-bomb/types/socket';
import { RoomBroadcaster } from '../core/RoomBroadcaster';
import {
  buildGameStartedPayload,
  buildTurnStartedPayload,
} from '../core/serialization';
import { deleteGameEngine } from '../game/engineRegistry';
import { removePlayersDiffCacheForRoom } from '../game/orchestration/playersDiffCache';

import type { TypedServer, TypedSocket } from './typedSocket';
import { createSocketDataAccessor } from './socketDataAccessor';
import { getLogContext, getLogger, runWithContext } from '../logging/context';

// Configurable grace period (ms) before removing a disconnected player.
// Tests may adjust via setDisconnectGrace().
export let DISCONNECT_GRACE_MS = 10000;
export function setDisconnectGrace(ms: number) {
  DISCONNECT_GRACE_MS = ms;
}

export function registerRoomHandlers(io: TypedServer, socket: TypedSocket) {
  const connectionContext = getLogContext();
  const withContext =
    <Args extends unknown[]>(handler: (...args: Args) => void) =>
    (...args: Args) => {
      runWithContext(connectionContext, () => {
        handler(...args);
      });
    };

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

  const createStringAccessor = (key: string) =>
    createSocketDataAccessor(
      socket,
      key,
      (value): value is string => typeof value === 'string',
    );

  const roomCodeAccessor = createStringAccessor('currentRoomCode');
  const playerIdAccessor = createStringAccessor('currentPlayerId');

  const getCurrentRoomCode = (): string | undefined => roomCodeAccessor.get();
  const setCurrentRoomCode = (code: string): void => {
    roomCodeAccessor.set(code);
  };
  const clearCurrentRoomCode = (): void => {
    roomCodeAccessor.clear();
  };

  const getCurrentPlayerId = (): string | undefined => playerIdAccessor.get();
  const setCurrentPlayerId = (playerId: string): void => {
    playerIdAccessor.set(playerId);
  };
  const clearCurrentPlayerId = (): void => {
    playerIdAccessor.clear();
  };

  const disposeRoom = (code: string, roomInstance: GameRoom): void => {
    try {
      roomInstance.cancelGameStartTimer();
    } catch (err) {
      const log = getLogger();
      log.warn(
        { event: 'room_cleanup_failed', gameId: code, err },
        'Failed to cancel game start timer',
      );
    }
    deleteGameEngine(code);
    removePlayersDiffCacheForRoom(code);
    roomManager.delete(code);
    getLogger().info(
      { event: 'room_disposed', gameId: code },
      'Disposed empty room',
    );
  };

  const cleanupRoomIfEmpty = (code: string): void => {
    const maybeRoom = roomManager.get(code);
    if (!maybeRoom) return;
    if (maybeRoom.getAllPlayers().length > 0) return;
    disposeRoom(code, maybeRoom);
  };

  function handleJoinRoom(raw: unknown, cb?: (res: BasicResponse) => void) {
    const callback = normalizeCb(cb);
    const parsed = parseJoinRoom(raw);
    if (!parsed) {
      callback({ success: false, error: 'Invalid payload' });
      return;
    }
    const { roomCode, playerId, name } = parsed;
    const log = getLogger();
    log.debug(
      {
        event: 'message_in',
        type: 'joinRoom',
        gameId: roomCode,
        playerId,
        socketId: socket.id,
      },
      'joinRoom received',
    );
    if (!name || name.length > 20) {
      log.warn(
        {
          event: 'invalid_player_name',
          playerId,
          attemptedNameLength: name.length,
          socketId: socket.id,
        },
        'Player name rejected',
      );
      callback({ success: false, error: 'Invalid player name' });
      return;
    }
    const room = roomManager.get(roomCode);
    if (!room) {
      log.warn(
        {
          event: 'room_not_found',
          type: 'joinRoom',
          gameId: roomCode,
          playerId,
          socketId: socket.id,
        },
        'Join room failed: room not found',
      );
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
            cleanupRoomIfEmpty(prevRoom);
          }
          // If player wasn't in prevRoom, suppress any leave announcement.
          void socket.leave(socketRoomId(prevRoom));
          log.info(
            {
              event: 'player_switched_room',
              fromGameId: prevRoom,
              gameId: roomCode,
              playerId,
              socketId: socket.id,
            },
            'Player moved to new room',
          );
        }
        setCurrentRoomCode(roomCode);
        void socket.join(socketRoomId(roomCode));
        log.info(
          {
            event: 'player_room_joined',
            gameId: roomCode,
            playerId,
            socketId: socket.id,
          },
          'Socket joined room',
        );
      }
      if (!room.hasPlayer(playerId)) {
        room.addPlayer({ id: playerId, name });
        system(roomCode, `${name} joined the room.`);
        emitPlayers(io, room);
        log.info(
          { event: 'player_joined', gameId: roomCode, playerId },
          'Player added to room roster',
        );
      } else {
        const existingPlayer = room.getPlayer(playerId);
        const previousName = existingPlayer?.name;
        const nameChanged =
          existingPlayer && typeof name === 'string' && previousName !== name;
        if (nameChanged) {
          try {
            room.updatePlayerName(playerId, name);
            log.info(
              {
                event: 'player_name_updated_on_reconnect',
                gameId: roomCode,
                playerId,
                previousName,
                nextName: name,
              },
              'Player updated display name on reconnect',
            );
          } catch (err) {
            log.warn(
              {
                event: 'player_name_update_failed',
                gameId: roomCode,
                playerId,
                attemptedName: name,
                err,
              },
              'Failed to update player name on reconnect, keeping previous name',
            );
          }
        }
        const reconnectSnapshot = room.getPlayer(playerId);
        const reconnectName = reconnectSnapshot ? reconnectSnapshot.name : name;
        const wasDisconnected = existingPlayer?.isConnected === false;
        room.setPlayerConnected(playerId, true);
        emitPlayers(io, room);
        if (wasDisconnected) {
          system(roomCode, `${reconnectName} reconnected.`);
        }
        log.info(
          { event: 'player_reconnected', gameId: roomCode, playerId },
          'Player reconnected to room',
        );
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
          log.warn(
            {
              event: 'existing_game_emit_failed',
              gameId: roomCode,
              playerId,
              err: e,
            },
            'Failed to emit existing game state to late joiner',
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
      log.error(
        { event: 'join_room_error', gameId: roomCode, playerId, err },
        'joinRoom handler error',
      );
      callback({ success: false, error: (err as Error).message });
    }
  }
  socket.on('joinRoom', withContext(handleJoinRoom));

  // leaveRoom event
  function handleLeaveRoom(raw: unknown) {
    const parsed = parseLeaveRoom(raw);
    if (!parsed) return;
    const { roomCode, playerId } = parsed;
    const log = getLogger();
    log.debug(
      {
        event: 'message_in',
        type: 'leaveRoom',
        gameId: roomCode,
        playerId,
        socketId: socket.id,
      },
      'leaveRoom received',
    );
    const room = roomManager.get(roomCode);
    if (!room) {
      log.warn(
        {
          event: 'room_not_found',
          type: 'leaveRoom',
          gameId: roomCode,
          playerId,
          socketId: socket.id,
        },
        'Leave room ignored: room missing',
      );
      return;
    }
    // Only announce/act if this player is actually in the room.
    const player = room.getPlayer(playerId);
    if (!player) {
      log.debug(
        {
          event: 'player_not_in_room',
          gameId: roomCode,
          playerId,
          socketId: socket.id,
        },
        'Leave ignored: player not found in room',
      );
      return;
    }
    const playerName = player.name;
    room.removePlayer(playerId);

    void socket.leave(socketRoomId(roomCode));
    emitPlayers(io, room);
    system(roomCode, `${playerName} left the room.`);
    log.info(
      { event: 'player_left', gameId: roomCode, playerId },
      'Player left room',
    );

    if (getCurrentPlayerId() === playerId) {
      clearCurrentPlayerId();
    }
    if (getCurrentRoomCode() === roomCode) {
      clearCurrentRoomCode();
    }

    cleanupRoomIfEmpty(roomCode);
  }
  socket.on('leaveRoom', withContext(handleLeaveRoom));

  // chatMessage event
  socket.on(
    'chatMessage',
    withContext((raw: unknown) => {
      try {
        const chatMessage = toAuthoritativeChatMessage(raw);
        io.to(socketRoomId(chatMessage.roomCode)).emit(
          'chatMessage',
          chatMessage,
        );
      } catch (err) {
        getLogger().warn(
          { event: 'invalid_chat_message', err, socketId: socket.id },
          'Rejected chat message',
        );
      }
    }),
  );

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
    const log = getLogger();
    log.debug(
      {
        event: 'message_in',
        type: 'setPlayerSeated',
        gameId: roomCode,
        playerId,
        socketId: socket.id,
        seated,
      },
      'setPlayerSeated received',
    );
    const room = roomManager.get(roomCode);
    if (!room) {
      log.warn(
        {
          event: 'room_not_found',
          type: 'setPlayerSeated',
          gameId: roomCode,
          playerId,
        },
        'setPlayerSeated failed: room not found',
      );
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
            log.error(
              { event: 'auto_start_error', gameId: roomCode, err },
              'Auto start failed',
            );
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
    log.info(
      {
        event: 'player_seated_changed',
        gameId: roomCode,
        playerId,
        seated,
      },
      'Updated player seating',
    );
    callback({ success: true });
  }
  socket.on('setPlayerSeated', withContext(handleSetPlayerSeated));

  // startGame event
  function handleStartGame(raw: unknown, cb?: (res: BasicResponse) => void) {
    const callback = normalizeCb(cb);
    const parsed = parseStartGame(raw);
    if (!parsed) {
      callback({ success: false, error: 'Invalid payload' });
      return;
    }
    const { roomCode } = parsed;
    const log = getLogger();
    log.debug(
      {
        event: 'message_in',
        type: 'startGame',
        gameId: roomCode,
        socketId: socket.id,
      },
      'startGame received',
    );
    const room = roomManager.get(roomCode);
    if (!room) {
      log.warn(
        {
          event: 'room_not_found',
          type: 'startGame',
          gameId: roomCode,
        },
        'startGame failed: room not found',
      );
      callback({ success: false, error: 'Room not found' });
      return;
    }
    try {
      const seatedPlayers = room
        .getAllPlayers()
        .filter((p: Player) => p.isSeated);
      if (seatedPlayers.length < 2) {
        log.info(
          {
            event: 'start_game_rejected',
            gameId: roomCode,
            seatedPlayers: seatedPlayers.length,
          },
          'startGame rejected: insufficient seated players',
        );
        callback({
          success: false,
          error: 'Need at least 2 seated players to start the game.',
        });
        return;
      }
      room.cancelGameStartTimer();
      startGameForRoom(io, room);
      log.info(
        {
          event: 'game_started',
          gameId: roomCode,
          players: seatedPlayers.length,
        },
        'Game start triggered by client',
      );
      callback({ success: true });
    } catch (err) {
      log.error(
        { event: 'start_game_error', gameId: roomCode, err },
        'startGame handler error',
      );
      callback({ success: false, error: (err as Error).message });
    }
  }
  socket.on('startGame', withContext(handleStartGame));

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
  socket.on('playerTyping', withContext(handlePlayerTyping));

  // submitWord event
  function handleSubmitWord(raw: unknown, cb?: (res: BasicResponse) => void) {
    const callback = normalizeCb(cb);
    const parsed = parseSubmitWord(raw);
    if (!parsed) {
      callback({ success: false, error: 'Invalid payload' });
      return;
    }
    const { roomCode, playerId, word, clientActionId } = parsed;
    const log = getLogger();
    log.debug(
      {
        event: 'message_in',
        type: 'submitWord',
        gameId: roomCode,
        playerId,
        socketId: socket.id,
        clientActionId,
      },
      'submitWord received',
    );
    const room = roomManager.get(roomCode);
    if (!room) {
      callback({ success: false, error: 'Room not found' });
      log.warn(
        {
          event: 'room_not_found',
          type: 'submitWord',
          gameId: roomCode,
          playerId,
        },
        'submitWord failed: room not found',
      );
      if (clientActionId) {
        socket.emit('actionAck', {
          clientActionId,
          success: false,
          error: 'Room not found',
        });
      }
      return;
    }

    if (!room.game) {
      callback({ success: false, error: 'Game not running.' });
      if (clientActionId) {
        socket.emit('actionAck', {
          clientActionId,
          success: false,
          error: 'Game not running.',
        });
      }
      return;
    }

    const engine = getGameEngine(roomCode);
    if (!engine) {
      log.warn(
        { event: 'engine_not_found', gameId: roomCode },
        'submitWord failed: engine missing',
      );
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
    log.info(
      {
        event: 'word_submitted',
        gameId: roomCode,
        playerId,
        word,
        success: result.success,
      },
      'Word submitted',
    );
    if (clientActionId) {
      socket.emit('actionAck', {
        clientActionId,
        success: result.success,
        error: result.success ? undefined : result.error,
      });
    }
  }
  socket.on('submitWord', withContext(handleSubmitWord));

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
    const log = getLogger();
    log.debug(
      {
        event: 'message_in',
        type: 'updateRoomRules',
        gameId: roomCode,
        socketId: socket.id,
      },
      'updateRoomRules received',
    );
    const room = roomManager.get(roomCode);
    if (!room) {
      log.warn(
        {
          event: 'room_not_found',
          type: 'updateRoomRules',
          gameId: roomCode,
        },
        'updateRoomRules failed: room not found',
      );
      callback({ success: false, error: 'Room not found' });
      return;
    }
    const playerId = getCurrentPlayerId();
    if (!playerId) {
      callback({ success: false, error: 'Player not recognized' });
      return;
    }
    if (room.getLeaderId() !== playerId) {
      log.warn(
        { event: 'rules_update_rejected', gameId: roomCode, playerId },
        'Non-leader attempted to update rules',
      );
      callback({ success: false, error: 'Only the leader can change rules.' });
      return;
    }
    const validation = GameRulesSchema.safeParse(rules);
    if (!validation.success) {
      const { issues } = validation.error;
      const errorMessage =
        issues.length > 0 ? issues[0].message : 'Invalid rules provided';
      callback({
        success: false,
        error: errorMessage,
      });
      log.warn(
        { event: 'rules_update_invalid', gameId: roomCode, playerId },
        'updateRoomRules validation failed',
      );
      return;
    }
    try {
      room.updateRules(validation.data);
      broadcaster.rules(room);
      const leaderName = room.getPlayer(playerId)?.name ?? 'Leader';
      system(roomCode, `${leaderName} updated the room rules.`);
      log.info(
        { event: 'rules_updated', gameId: roomCode, playerId },
        'Room rules updated',
      );
      callback({ success: true });
    } catch (error) {
      log.error(
        { event: 'rules_update_error', gameId: roomCode, playerId, err: error },
        'updateRoomRules handler error',
      );
      callback({ success: false, error: (error as Error).message });
    }
  }
  socket.on('updateRoomRules', withContext(handleUpdateRoomRules));

  // disconnect event
  socket.on(
    'disconnect',
    withContext(() => {
      const roomCode = getCurrentRoomCode();
      if (!roomCode) return;
      const room = roomManager.get(roomCode);
      if (!room) return;
      const playerId = getCurrentPlayerId();
      if (!playerId) return; // player never completed join
      // Instead of removing immediately, mark disconnected to allow reconnection window
      if (room.hasPlayer(playerId)) {
        const player = room.getPlayer(playerId);
        const playerName = player?.name ?? 'A player';
        const wasAlreadyEliminated = player?.isEliminated === true;
        room.setPlayerConnected(playerId, false);
        emitPlayers(io, room);
        system(
          roomCode,
          wasAlreadyEliminated
            ? `${playerName} disconnected.`
            : `${playerName} disconnected (will be removed if not back soon).`,
        );
        const log = getLogger();
        log.info(
          {
            event: 'player_disconnected',
            gameId: roomCode,
            playerId,
            socketId: socket.id,
          },
          'Player marked disconnected',
        );
        // schedule removal if not reconnected after timeout
        setTimeout(() => {
          const stillRoom = roomManager.get(roomCode);
          if (!stillRoom) return;
          const p = stillRoom.getPlayer(playerId);
          if (p && !p.isConnected) {
            const name = p.name;
            const engine = getGameEngine(roomCode);
            const alreadyEliminated = p.isEliminated;
            if (stillRoom.game && engine && !alreadyEliminated) {
              engine.forfeitPlayer(playerId);
            }
            stillRoom.removePlayer(playerId);
            emitPlayers(io, stillRoom);
            if (!alreadyEliminated) {
              system(roomCode, `${name} was eliminated after disconnecting.`);
            }
            cleanupRoomIfEmpty(roomCode);
          }
        }, DISCONNECT_GRACE_MS); // grace period
      }

      if (getCurrentPlayerId() === playerId) {
        clearCurrentPlayerId();
      }
      if (getCurrentRoomCode() === roomCode) {
        clearCurrentRoomCode();
      }
    }),
  );

  // Enhance joinRoom to treat existing disconnected player as reconnect
  // (Patch inserted near top of handler inside existing joinRoom listener)
}
