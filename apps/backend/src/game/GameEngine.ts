import { Game } from '@game/domain/game/Game';
import { getRandomFragment, isValidWord } from '../dictionary';
import { Player } from '@game/domain/players/Player';
import type { ServerToClientEvents } from '@game/domain/socket/types';

type EmitFn = <K extends keyof ServerToClientEvents>(
  event: K,
  ...args: Parameters<ServerToClientEvents[K]>
) => void;

interface GameEngineOptions {
  game: Game;
  onTurnTimeout?: (player: Player) => void;
  onTurnStarted: () => void;
  onGameEnded: (winnerId: string) => void;
  emit: EmitFn;
}

export class GameEngine {
  private game: Game;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private readonly emit: EmitFn;
  private readonly onTurnTimeout: ((player: Player) => void) | undefined;
  private readonly onTurnStarted: () => void;
  private readonly onGameEnded: (winnerId: string) => void;

  constructor(opts: GameEngineOptions) {
    this.game = opts.game;
    this.emit = opts.emit;
    this.onTurnTimeout = opts.onTurnTimeout;
    this.onTurnStarted = opts.onTurnStarted;
    this.onGameEnded = opts.onGameEnded;
  }

  public beginGame(): void {
    this.startTurn();
  }

  private startTurn(): void {
    const currentPlayer = this.game.getCurrentPlayer();

    const duration = this.game.getBombDuration();
    this.clearTimeout();

    this.timeout = setTimeout(() => {
      const currentPlayer = this.game.getCurrentPlayer();

      currentPlayer.loseLife();
      this.emit('playerUpdated', {
        playerId: currentPlayer.id,
        lives: currentPlayer.lives,
      });

      if (this.onTurnTimeout) {
        this.onTurnTimeout(currentPlayer);
      }

      if (this.checkGameOver()) return;

      this.advanceTurn();
    }, duration * 1000);

    this.onTurnStarted();
    this.emit('turnStarted', {
      playerId: currentPlayer.id,
      fragment: this.game.fragment,
      bombDuration: duration,
      players: this.game.players.map((p) => ({
        id: p.id,
        name: p.name,
        isEliminated: p.isEliminated,
        lives: p.lives,
      })),
    });
  }

  private advanceTurn(): void {
    // Domain-level
    this.game.nextTurn();
    this.game.setFragment(getRandomFragment(this.game.rules.minWordsPerPrompt));

    // Application-level
    this.startTurn();
  }

  public submitWord(
    playerId: string,
    word: string,
  ): { success: boolean; error?: string } {
    const player = this.game.getCurrentPlayer();
    if (player.id !== playerId)
      return { success: false, error: 'Not your turn.' };

    if (word.trim().length < 2)
      return { success: false, error: 'Invalid word (too short).' };

    if (!word.toLowerCase().includes(this.game.fragment.toLowerCase())) {
      return { success: false, error: "Word doesn't contain the fragment." };
    }

    if (!isValidWord(word)) {
      return { success: false, error: 'Not a valid word.' };
    }

    for (const letter of word) {
      player.tryBonusLetter(
        letter,
        this.game.rules.maxLives,
        this.game.rules.bonusTemplate,
      );
    }

    this.emit('wordAccepted', { playerId, word });

    this.game.adjustBombTimerAfterValidWord();

    if (this.checkGameOver()) return { success: true };

    this.advanceTurn();

    return { success: true };
  }

  private checkGameOver(): boolean {
    const remaining = this.game.players.filter((p) => !p.isEliminated);
    if (remaining.length <= 1) {
      const winnerId = remaining[0]?.id;
      if (winnerId) this.onGameEnded(winnerId);
      return true;
    }
    return false;
  }

  public clearTimeout() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }
}
