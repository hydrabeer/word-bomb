import type { DictionaryPort } from '../dictionary';
import { Game } from '@game/domain/game/Game';
import { GameRulesService } from '@game/domain/game/services/GameRulesService';
import { Player } from '@game/domain/players/Player';
import type { ServerToClientEvents } from '@word-bomb/types/socket';
import { buildTurnStartedPayload } from '../core/serialization';

/**
 * Abstraction over timer management used to drive turn timeouts.
 */
export interface TurnScheduler {
  /**
   * Schedules a callback after the specified delay.
   *
   * @param delayMs - The delay in milliseconds before `cb` executes.
   * @param cb - The callback to execute once the delay elapses.
   * @returns An opaque token that can later be used to cancel the timer.
   */
  schedule(delayMs: number, cb: () => void): object | number;
  /**
   * Cancels a previously scheduled callback.
   *
   * @param token - The token returned by {@link TurnScheduler.schedule}.
   */
  cancel(token: object | number): void;
}

/**
 * Port that receives high-level lifecycle notifications emitted by the engine.
 */
export interface GameEventsPort {
  /**
   * Signals that a new turn has begun.
   *
   * @param game - The latest game state after the turn transition.
   */
  turnStarted(game: Game): void;
  /**
   * Announces that a player's lives total changed.
   *
   * @param playerId - The identifier of the affected player.
   * @param lives - The updated remaining lives.
   */
  playerUpdated(playerId: string, lives: number): void;
  /**
   * Reports that a word submission has been accepted.
   *
   * @param playerId - The identifier of the submitting player.
   * @param word - The accepted word.
   */
  wordAccepted(playerId: string, word: string): void;
  /**
   * Notifies that the game concluded with the provided winner.
   *
   * @param winnerId - The identifier of the winning player.
   */
  gameEnded(winnerId: string): void;
}

type EmitFn = <K extends keyof ServerToClientEvents>(
  event: K,
  ...args: Parameters<ServerToClientEvents[K]>
) => void;

/**
 * Internal configuration bundle for {@link GameEngine} construction.
 */
interface GameEngineOptions {
  /** Game instance whose lifecycle is orchestrated by the engine. */
  game: Game;
  /**
   * Transport-specific emitter used for legacy direct socket events while ports evolve.
   */
  emit: EmitFn;
  /** Timer implementation that drives turn transitions. */
  scheduler: TurnScheduler;
  /** Domain events sink kept in sync with the active room. */
  eventsPort: GameEventsPort;
  /** Dictionary adapter that validates submissions and generates fragments. */
  dictionary: DictionaryPort;
  /** Optional callback when a player times out on their turn. */
  onTurnTimeout?: (player: Player) => void;
}

/**
 * Drives the live lifecycle of a running game: validating submissions, rotating turns,
 * and emitting state changes to the surrounding infrastructure.
 */
export class GameEngine {
  private game: Game;
  private rules: GameRulesService;
  private timeoutToken: object | number | null = null;
  private readonly emit: EmitFn;
  private readonly onTurnTimeout: ((player: Player) => void) | undefined;
  private readonly scheduler: TurnScheduler;
  private readonly eventsPort: GameEventsPort;
  /**
   * Creates a new engine backed by the provided dictionary, scheduler, and event ports.
   *
   * @param opts - Dependencies used to orchestrate the game lifecycle.
   */
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

  /**
   * Starts the gameplay loop by scheduling the first turn timeout and notifying listeners.
   */
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

  /**
   * Handles a player's word submission for the current turn.
   *
   * @param playerId - Identifier of the submitting player.
   * @param word - The candidate word to validate.
   * @returns Result containing success status and an optional validation error message.
   */
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

  /**
   * Cancels any pending turn timeout to prevent further turn progression.
   */
  public clearTimeout() {
    if (this.timeoutToken) {
      this.scheduler.cancel(this.timeoutToken);
      this.timeoutToken = null;
    }
  }

  /**
   * Removes the specified player from the game, redistributing turn order as needed.
   *
   * @param playerId - Identifier of the player forfeiting.
   */
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
