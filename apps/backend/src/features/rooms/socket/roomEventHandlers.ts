import { roomManager } from '../app/roomManagerSingleton';
import { getGameEngine } from '../../gameplay/engine/engineRegistry';
import { emitPlayers } from '../../gameplay/app/emitPlayers';
import { socketRoomId } from '../../../shared/utils/socketRoomId';
import { startGameForRoom } from '../../gameplay/app/startGameForRoom';
import { toAuthoritativeChatMessage } from '@game/domain/chat/ChatMessage';
import { GameRulesSchema } from '@game/domain/rooms/GameRoomRules';
import { getLogger } from '../../../platform/logging/context';
import type { Player } from '@game/domain/players/Player';
import type { BasicResponse } from '@word-bomb/types/socket';
import {
  buildGameStartedPayload,
  buildTurnStartedPayload,
} from '../../../platform/socket/serialization';
import { noop } from '@game/domain/utils/noop';
import {
  parseJoinRoom,
  parseLeaveRoom,
  parsePlayerTyping,
  parseSetPlayerSeated,
  parseStartGame,
  parseSubmitWord,
  parseUpdateRoomRules,
} from './roomPayloadParsers';
import { DISCONNECT_GRACE_MS } from './disconnectGrace';
import type { RoomHandlerContext } from './roomHandlerContext';

/**
 * Normalizes optional acknowledgement callbacks supplied by Socket.IO.
 */
function normalizeAck(cb: unknown): (res: BasicResponse) => void {
  return typeof cb === 'function' ? (cb as (res: BasicResponse) => void) : noop;
}

/**
 * Contract for every room-scoped Socket.IO handler bound to an individual client.
 */
export interface RoomEventHandlers {
  readonly joinRoom: (raw: unknown, cb?: (res: BasicResponse) => void) => void;
  readonly leaveRoom: (raw: unknown) => void;
  readonly chatMessage: (raw: unknown) => void;
  readonly setPlayerSeated: (
    raw: unknown,
    cb?: (res: BasicResponse) => void,
  ) => void;
  readonly startGame: (raw: unknown, cb?: (res: BasicResponse) => void) => void;
  readonly playerTyping: (raw: unknown) => void;
  readonly submitWord: (
    raw: unknown,
    cb?: (res: BasicResponse) => void,
  ) => void;
  readonly updateRoomRules: (
    raw: unknown,
    cb?: (res: BasicResponse) => void,
  ) => void;
  readonly disconnect: () => void;
}

/**
 * Creates the set of Socket.IO room event handlers backed by the provided context.
 *
 * @param context - Shared runtime state for the connected socket.
 * @returns Functions suitable for registration with `socket.on`.
 */
export function createRoomEventHandlers(
  context: RoomHandlerContext,
): RoomEventHandlers {
  const { io, socket, session, system, cleanupRoomIfEmpty, broadcaster } =
    context;

  const handleJoinRoom = (raw: unknown, cb?: (res: BasicResponse) => void) => {
    const callback = normalizeAck(cb);
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
      const existing = session.getRoomCode();
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
        session.setRoomCode(roomCode);
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
        emitPlayers(io, room, { snapshotTargets: [socket.id] });
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
          const updated = room.updatePlayerName(playerId, name);
          if (updated) {
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
          } else {
            log.warn(
              {
                event: 'player_name_update_failed',
                gameId: roomCode,
                playerId,
                attemptedName: name,
              },
              'Failed to update player name on reconnect, keeping previous name',
            );
          }
        }
        const reconnectSnapshot = room.getPlayer(playerId);
        const reconnectName =
          reconnectSnapshot?.name ?? previousName ?? 'Someone';
        const wasDisconnected = existingPlayer?.isConnected === false;
        room.setPlayerConnected(playerId, true);
        emitPlayers(io, room, { snapshotTargets: [socket.id] });
        if (wasDisconnected) {
          system(roomCode, `${reconnectName} reconnected.`);
        }
        log.info(
          { event: 'player_reconnected', gameId: roomCode, playerId },
          'Player reconnected to room',
        );
      }

      session.setPlayerId(playerId);

      if (room.game) {
        try {
          const game = room.game;
          socket.emit('gameStarted', buildGameStartedPayload(game));
          socket.emit('turnStarted', buildTurnStartedPayload(game));
        } catch (error) {
          log.warn(
            {
              event: 'existing_game_emit_failed',
              gameId: roomCode,
              playerId,
              err: error,
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
  };

  const handleLeaveRoom = (raw: unknown) => {
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

    if (session.getPlayerId() === playerId) {
      session.clearPlayerId();
    }
    if (session.getRoomCode() === roomCode) {
      session.clearRoomCode();
    }

    cleanupRoomIfEmpty(roomCode);
  };

  const handleChatMessage = (raw: unknown) => {
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
  };

  const handleSetPlayerSeated = (
    raw: unknown,
    cb?: (res: BasicResponse) => void,
  ) => {
    const callback = normalizeAck(cb);
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
    } else if (room.isGameTimerRunning()) {
      room.cancelGameStartTimer();
      io.to(socketRoomId(roomCode)).emit('gameCountdownStopped');
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
  };

  const handleStartGame = (raw: unknown, cb?: (res: BasicResponse) => void) => {
    const callback = normalizeAck(cb);
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
  };

  const handlePlayerTyping = (raw: unknown) => {
    const parsed = parsePlayerTyping(raw);
    if (!parsed) return;

    const { roomCode, playerId, input } = parsed;
    const room = roomManager.get(roomCode);
    if (!room?.game) return;

    const currentPlayer = room.game.getCurrentPlayer();
    if (currentPlayer.id !== playerId) return;

    io.to(socketRoomId(roomCode)).emit('playerTypingUpdate', {
      playerId,
      input,
    });
  };

  const handleSubmitWord = (
    raw: unknown,
    cb?: (res: BasicResponse) => void,
  ) => {
    const callback = normalizeAck(cb);
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
  };

  const handleUpdateRoomRules = (
    raw: unknown,
    cb?: (res: BasicResponse) => void,
  ) => {
    const callback = normalizeAck(cb);
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

    const playerId = session.getPlayerId();
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
      callback({ success: false, error: errorMessage });
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
  };

  const handleDisconnect = () => {
    const roomCode = session.getRoomCode();
    if (!roomCode) return;
    const room = roomManager.get(roomCode);
    if (!room) return;
    const playerId = session.getPlayerId();
    if (!playerId) return;
    if (!room.hasPlayer(playerId)) return;

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
    getLogger().info(
      {
        event: 'player_disconnected',
        gameId: roomCode,
        playerId,
        socketId: socket.id,
      },
      'Player marked disconnected',
    );

    setTimeout(() => {
      const stillRoom = roomManager.get(roomCode);
      if (!stillRoom) return;
      const disconnectedPlayer = stillRoom.getPlayer(playerId);
      if (disconnectedPlayer && !disconnectedPlayer.isConnected) {
        const name = disconnectedPlayer.name;
        const engine = getGameEngine(roomCode);
        const alreadyEliminated = disconnectedPlayer.isEliminated;
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
    }, DISCONNECT_GRACE_MS);

    if (session.getPlayerId() === playerId) {
      session.clearPlayerId();
    }
    if (session.getRoomCode() === roomCode) {
      session.clearRoomCode();
    }
  };

  return {
    joinRoom: handleJoinRoom,
    leaveRoom: handleLeaveRoom,
    chatMessage: handleChatMessage,
    setPlayerSeated: handleSetPlayerSeated,
    startGame: handleStartGame,
    playerTyping: handlePlayerTyping,
    submitWord: handleSubmitWord,
    updateRoomRules: handleUpdateRoomRules,
    disconnect: handleDisconnect,
  };
}
