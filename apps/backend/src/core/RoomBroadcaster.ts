import { Buffer } from 'node:buffer';
import { socketRoomId } from '../utils/socketRoomId';
import type { TypedServer } from '../socket/typedSocket';
import type { Game } from '@game/domain/game/Game';
import type { GameRoom } from '@game/domain/rooms/GameRoom';
import type {
  ServerToClientEvents,
  PlayersDiffPayload,
} from '@word-bomb/types/socket';
import {
  buildPlayersUpdatedPayload,
  buildGameStartedPayload,
  buildTurnStartedPayload,
} from './serialization';
import { getLogger } from '../logging/context';

/**
 * Provides a thin abstraction over the socket server for broadcasting room and game events.
 *
 * @remarks
 *  Ensures consistent logging and payload measurement for every emitted event so operational
 *  telemetry stays aligned across the backend.
 */
export class RoomBroadcaster {
  constructor(private io: TypedServer) {}

  /**
   * Emits a typed socket event to the room namespace, logging telemetry around the emission.
   *
   * @param roomCode - Code for the room to emit into.
   * @param event - Event name from the socket contract.
   * @param args - Arguments supplied to the event handler on the client.
   */
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

  /**
   * Broadcasts the latest player roster and optional diff for a given room.
   *
   * @param room - Source room whose roster should be emitted.
   * @param diff - Optional diff payload describing player mutations.
   */
  players(room: GameRoom, diff?: PlayersDiffPayload): void {
    const roomCode = room.code;
    if (diff) this.emit(roomCode, 'playersDiff', diff);
    this.emit(roomCode, 'playersUpdated', buildPlayersUpdatedPayload(room));
  }

  /**
   * Notifies clients about updated room rules, cloning array state to avoid shared references.
   *
   * @param room - Room whose rules should be synchronized.
   */
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

  /**
   * Announces that the game has started and issues the full game start payload.
   *
   * @param room - Room metadata used for leader identification and logging.
   * @param game - Game instance containing the authoritative state snapshot.
   */
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

  /**
   * Broadcasts that a new turn has begun and emits the active player context.
   *
   * @param game - Game whose turn state should be shared with clients.
   */
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

  /**
   * Signals that the game has ended and optionally includes the winner.
   *
   * @param roomCode - Code for the room whose game concluded.
   * @param winnerId - Identifier for the winning player, or null on stalemate.
   */
  gameEnded(roomCode: string, winnerId: string | null): void {
    getLogger().info(
      { event: 'round_ended', gameId: roomCode, winnerId },
      'Game ended',
    );
    this.emit(roomCode, 'gameEnded', { winnerId });
  }

  /**
   * Updates a single player's state, logging eliminations for observability.
   *
   * @param roomCode - Room containing the player.
   * @param playerId - Identifier for the player being updated.
   * @param lives - The player's current remaining lives.
   */
  playerUpdated(roomCode: string, playerId: string, lives: number): void {
    if (lives <= 0) {
      getLogger().info(
        { event: 'player_eliminated', gameId: roomCode, playerId },
        'Player eliminated',
      );
    }
    this.emit(roomCode, 'playerUpdated', { playerId, lives });
  }

  /**
   * Emits a word acceptance event so clients can update logs and UI.
   *
   * @param roomCode - Room where the word was played.
   * @param playerId - Player who submitted the word.
   * @param word - Word that was accepted into the round.
   */
  wordAccepted(roomCode: string, playerId: string, word: string): void {
    this.emit(roomCode, 'wordAccepted', { playerId, word });
  }

  /**
   * Sends a system-authored chat message to all room participants.
   *
   * @param roomCode - Room receiving the system message.
   * @param message - Message text to display.
   */
  systemMessage(roomCode: string, message: string): void {
    this.emit(roomCode, 'chatMessage', {
      roomCode,
      sender: 'System',
      message,
      timestamp: Date.now(),
      type: 'system',
    });
  }

  /**
   * Announces that the pre-game countdown has started with a specific deadline.
   *
   * @param roomCode - Room affected by the countdown.
   * @param deadline - Epoch millis when the countdown elapses.
   */
  countdownStarted(roomCode: string, deadline: number): void {
    this.emit(roomCode, 'gameCountdownStarted', { deadline });
  }

  /**
   * Signals that the pre-game countdown has been cancelled or finished early.
   *
   * @param roomCode - Room whose countdown should stop animating client-side.
   */
  countdownStopped(roomCode: string): void {
    this.emit(roomCode, 'gameCountdownStopped');
  }
}
