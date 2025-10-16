import type { Game } from '@game/domain/game/Game';
import type { GameRoom } from '@game/domain/rooms/GameRoom';
import type { GameEventsPort } from '../engine/GameEngine';
import { RoomBroadcaster } from '../../../platform/socket/RoomBroadcaster';
import { deleteGameEngine } from '../engine/engineRegistry';
import { computePlayersDiff } from './playersDiffCache';

/**
 * Bridges {@link GameEngine} domain events to socket broadcasts for a specific room.
 */
export class GameRoomEventsAdapter implements GameEventsPort {
  constructor(
    private readonly room: GameRoom,
    private readonly broadcaster: RoomBroadcaster,
  ) {}

  /** @inheritdoc */
  turnStarted(game: Game): void {
    this.broadcaster.turnStarted(game);
  }

  /** @inheritdoc */
  playerUpdated(playerId: string, lives: number): void {
    this.broadcaster.playerUpdated(this.room.code, playerId, lives);
  }

  /** @inheritdoc */
  wordAccepted(playerId: string, word: string): void {
    this.broadcaster.wordAccepted(this.room.code, playerId, word);
  }

  /** @inheritdoc */
  gameEnded(winnerId: string): void {
    this.broadcaster.gameEnded(this.room.code, winnerId);
    this.room.endGame();
    this.emitPlayers();
    deleteGameEngine(this.room.code);
  }

  private emitPlayers(): void {
    const diff = computePlayersDiff(this.room);
    this.broadcaster.players(this.room, diff ?? undefined);
  }
}
