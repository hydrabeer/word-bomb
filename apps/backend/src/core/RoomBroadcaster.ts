import { Buffer } from 'node:buffer';
import { socketRoomId } from '../utils/socketRoomId';
import type { TypedServer } from '../socket/typedSocket';
import type { Game, GameRoom } from '@game/domain';
import type {
  ServerToClientEvents,
  PlayersDiffPayload,
} from '@word-bomb/types';
import {
  buildPlayersUpdatedPayload,
  buildGameStartedPayload,
  buildTurnStartedPayload,
} from './serialization';
import { getLogger } from '../logging/context';

export class RoomBroadcaster {
  constructor(private io: TypedServer) {}

  private emit<K extends keyof ServerToClientEvents>(
    roomCode: string,
    event: K,
    ...args: Parameters<ServerToClientEvents[K]>
  ) {
    const log = getLogger();
    let payloadSize: number | undefined;
    if (args.length > 0) {
      try {
        const payload = args.length === 1 ? args[0] : args;
        payloadSize = Buffer.byteLength(JSON.stringify(payload));
      } catch (error) {
        log.warn(
          {
            event: 'message_out_serialize_failed',
            gameId: roomCode,
            type: event,
            err: error,
          },
          'Failed to measure payload size',
        );
      }
    }
    log.debug(
      {
        event: 'message_out',
        gameId: roomCode,
        type: event,
        payloadSize,
      },
      'Emitting socket message',
    );
    this.io.to(socketRoomId(roomCode)).emit(event, ...args);
  }

  players(room: GameRoom, diff?: PlayersDiffPayload): void {
    const roomCode = room.code;
    if (diff) this.emit(roomCode, 'playersDiff', diff);
    this.emit(roomCode, 'playersUpdated', buildPlayersUpdatedPayload(room));
  }

  rules(room: GameRoom): void {
    const { bonusTemplate, ...rest } = room.rules;
    this.emit(room.code, 'roomRulesUpdated', {
      roomCode: room.code,
      rules: {
        ...rest,
        bonusTemplate: [...bonusTemplate],
      },
    });
  }

  gameStarted(room: GameRoom, game: Game): void {
    const log = getLogger();
    log.info(
      {
        event: 'game_started',
        gameId: room.code,
        players: game.players.length,
      },
      'Game started',
    );
    this.emit(room.code, 'gameStarted', buildGameStartedPayload(room, game));
  }

  turnStarted(game: Game): void {
    const log = getLogger();
    try {
      const currentPlayer = game.getCurrentPlayer();
      log.info(
        {
          event: 'round_started',
          gameId: game.roomCode,
          playerId: currentPlayer.id,
          turnIndex: game.currentTurnIndex,
        },
        'Round started',
      );
    } catch (error) {
      log.warn(
        {
          event: 'round_start_context_missing',
          gameId: game.roomCode,
          err: error,
        },
        'Unable to determine current player for round start',
      );
    }
    this.emit(game.roomCode, 'turnStarted', buildTurnStartedPayload(game));
  }

  gameEnded(roomCode: string, winnerId: string | null): void {
    getLogger().info(
      { event: 'round_ended', gameId: roomCode, winnerId },
      'Game ended',
    );
    this.emit(roomCode, 'gameEnded', { winnerId });
  }

  playerUpdated(roomCode: string, playerId: string, lives: number): void {
    if (lives <= 0) {
      getLogger().info(
        { event: 'player_eliminated', gameId: roomCode, playerId },
        'Player eliminated',
      );
    }
    this.emit(roomCode, 'playerUpdated', { playerId, lives });
  }

  wordAccepted(roomCode: string, playerId: string, word: string): void {
    this.emit(roomCode, 'wordAccepted', { playerId, word });
  }

  systemMessage(roomCode: string, message: string): void {
    this.emit(roomCode, 'chatMessage', {
      roomCode,
      sender: 'System',
      message,
      timestamp: Date.now(),
      type: 'system',
    });
  }

  countdownStarted(roomCode: string, deadline: number): void {
    this.emit(roomCode, 'gameCountdownStarted', { deadline });
  }

  countdownStopped(roomCode: string): void {
    this.emit(roomCode, 'gameCountdownStopped');
  }
}
