import { Game, GameRulesService, Player } from '@game/domain';
import { isValidWord, getRandomFragment } from '../dictionary';
import type { ServerToClientEvents } from '@word-bomb/types';
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
      { isValid: (w: string) => isValidWord(w) },
      { nextFragment: (min: number) => getRandomFragment(min) },
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
      const currentPlayer = this.rules.getCurrentPlayer();

      currentPlayer.loseLife();
      this.emit('playerUpdated', {
        playerId: currentPlayer.id,
        lives: currentPlayer.lives,
      });
      this.eventsPort.playerUpdated(currentPlayer.id, currentPlayer.lives);

      if (this.onTurnTimeout) {
        this.onTurnTimeout(currentPlayer);
      }

      if (this.handleGameOverIfAny()) return;

      this.advanceTurn();
    });

    this.eventsPort.turnStarted(this.game);
    this.emit('turnStarted', buildTurnStartedPayload(this.game));
  }

  private advanceTurn(): void {
    this.rules.advanceTurn();
    this.startTurn();
  }

  private validateSubmission(playerId: string, word: string): string | null {
    return this.rules.validateSubmission(playerId, word);
  }

  public submitWord(
    playerId: string,
    word: string,
  ): { success: boolean; error?: string } {
    const error = this.validateSubmission(playerId, word);
    if (error) return { success: false, error };
    const player = this.rules.getCurrentPlayer();
    this.rules.applyAcceptedWord(player, word);
    this.emit('wordAccepted', { playerId, word });
    this.eventsPort.wordAccepted(playerId, word);
    if (this.handleGameOverIfAny()) return { success: true };

    this.advanceTurn();

    return { success: true };
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
}
