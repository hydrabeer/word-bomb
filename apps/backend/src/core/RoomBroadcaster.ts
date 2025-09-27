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

export class RoomBroadcaster {
  constructor(private io: TypedServer) {}

  private emit<K extends keyof ServerToClientEvents>(
    roomCode: string,
    event: K,
    ...args: Parameters<ServerToClientEvents[K]>
  ) {
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
    this.emit(room.code, 'gameStarted', buildGameStartedPayload(room, game));
  }

  turnStarted(game: Game): void {
    this.emit(game.roomCode, 'turnStarted', buildTurnStartedPayload(game));
  }

  gameEnded(roomCode: string, winnerId: string | null): void {
    this.emit(roomCode, 'gameEnded', { winnerId });
  }

  playerUpdated(roomCode: string, playerId: string, lives: number): void {
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
