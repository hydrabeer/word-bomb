import type { Game } from '@game/domain/game/Game';
import type { GameRoom } from '@game/domain/rooms/GameRoom';
import type { GameEventsPort } from '../GameEngine';
import { RoomBroadcaster } from '../../core/RoomBroadcaster';
import { deleteGameEngine } from '../engineRegistry';
import { computePlayersDiff } from './playersDiffCache';

export class GameRoomEventsAdapter implements GameEventsPort {
  constructor(
    private readonly room: GameRoom,
    private readonly broadcaster: RoomBroadcaster,
  ) {}

  turnStarted(game: Game): void {
    this.broadcaster.turnStarted(game);
  }

  playerUpdated(playerId: string, lives: number): void {
    this.broadcaster.playerUpdated(this.room.code, playerId, lives);
  }

  wordAccepted(playerId: string, word: string): void {
    this.broadcaster.wordAccepted(this.room.code, playerId, word);
  }

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
