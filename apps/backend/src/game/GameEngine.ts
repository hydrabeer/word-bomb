import type { DictionaryPort } from '../dictionary';
import { Game } from '@game/domain/game/Game';
import { GameRulesService } from '@game/domain/game/services/GameRulesService';
import { Player } from '@game/domain/players/Player';
import type { ServerToClientEvents } from '@word-bomb/types/socket';
import { buildTurnStartedPayload } from '../core/serialization';

// Abstractions extracted for clean architecture
export interface TurnScheduler {
  schedule(delayMs: number, cb: () => void): object | number;
  cancel(token: object | number): void;
}

export interface GameEventsPort {
  turnStarted(game: Game): void;
  playerUpdated(playerId: string, lives: number): void;
  wordAccepted(playerId: string, word: string): void;
  gameEnded(winnerId: string): void;
}

type EmitFn = <K extends keyof ServerToClientEvents>(
  event: K,
  ...args: Parameters<ServerToClientEvents[K]>
) => void;

interface GameEngineOptions {
  game: Game;
  emit: EmitFn; // temporary direct emitter for legacy events
  scheduler: TurnScheduler;
  eventsPort: GameEventsPort;
  dictionary: DictionaryPort;
  onTurnTimeout?: (player: Player) => void;
}

export class GameEngine {
  private game: Game;
  private rules: GameRulesService;
  private timeoutToken: object | number | null = null;
  private readonly emit: EmitFn;
  private readonly onTurnTimeout: ((player: Player) => void) | undefined;
  private readonly scheduler: TurnScheduler;
  private readonly eventsPort: GameEventsPort;
  constructor(opts: GameEngineOptions) {
    this.game = opts.game;
    this.rules = new GameRulesService(
      this.game,
      { isValid: (w: string) => opts.dictionary.isValid(w) },
      { nextFragment: (min: number) => opts.dictionary.getRandomFragment(min) },
    );
    this.emit = opts.emit;
    this.onTurnTimeout = opts.onTurnTimeout;
    this.scheduler = opts.scheduler;
    this.eventsPort = opts.eventsPort;
  }

  public beginGame(): void {
    this.startTurn();
  }

  private startTurn(): void {
    const duration = this.game.getBombDuration();
    this.clearTimeout();

    this.timeoutToken = this.scheduler.schedule(duration * 1000, () => {
      this.handleTurnTimeout();
    });

    this.eventsPort.turnStarted(this.game);
    this.emit('turnStarted', buildTurnStartedPayload(this.game));
  }

  private advanceTurn(): void {
    this.rules.advanceTurn();
    this.startTurn();
  }

  public submitWord(
    playerId: string,
    word: string,
  ): { success: boolean; error?: string } {
    const error = this.rules.validateSubmission(playerId, word);
    if (error) return { success: false, error };
    const player = this.rules.getCurrentPlayer();
    this.rules.applyAcceptedWord(player, word);
    this.notifyWordAccepted(playerId, word);
    if (this.handleGameOverIfAny()) return { success: true };

    this.advanceTurn();

    return { success: true };
  }

  private handleTurnTimeout(): void {
    const currentPlayer = this.rules.getCurrentPlayer();
    currentPlayer.loseLife();
    this.notifyPlayerUpdated(currentPlayer);

    if (this.onTurnTimeout) {
      this.onTurnTimeout(currentPlayer);
    }

    if (this.handleGameOverIfAny()) return;

    this.advanceTurn();
  }

  private notifyPlayerUpdated(player: Player): void {
    this.emit('playerUpdated', {
      playerId: player.id,
      lives: player.lives,
    });
    this.eventsPort.playerUpdated(player.id, player.lives);
  }

  private notifyWordAccepted(playerId: string, word: string): void {
    this.emit('wordAccepted', { playerId, word });
    this.eventsPort.wordAccepted(playerId, word);
  }

  private handleGameOverIfAny(): boolean {
    const { ended, winnerId } = this.rules.checkGameOver();
    if (ended) {
      if (winnerId) this.eventsPort.gameEnded(winnerId);
      return true;
    }
    return false;
  }

  public clearTimeout() {
    if (this.timeoutToken) {
      this.scheduler.cancel(this.timeoutToken);
      this.timeoutToken = null;
    }
  }

  public forfeitPlayer(playerId: string): void {
    const player = this.game.players.find((p) => p.id === playerId);
    if (!player || player.isEliminated) return;

    let currentId: string | null = null;
    try {
      currentId = this.rules.getCurrentPlayer().id;
    } catch {
      currentId = null;
    }

    player.lives = 0;
    player.eliminate();
    this.notifyPlayerUpdated(player);

    if (this.handleGameOverIfAny()) {
      this.clearTimeout();
      return;
    }

    if (currentId && currentId === playerId) {
      const active = this.game.getActivePlayers();
      if (active.length > 0) {
        this.game.currentTurnIndex = active.length - 1;
      }
      this.advanceTurn();
      return;
    }

    if (currentId && currentId !== playerId) {
      const active = this.game.getActivePlayers();
      const index = active.findIndex((p) => p.id === currentId);
      if (index >= 0) {
        this.game.currentTurnIndex = index;
        return;
      }
    }

    this.advanceTurn();
  }
}
