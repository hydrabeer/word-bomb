// Domain service extracted from GameEngine for pure turn + validation logic.
import { Game } from '../Game';
import type { Player } from '../../players/Player';

export interface SubmissionResult {
  success: boolean;
  error?: string;
  wordAccepted?: boolean;
  gameEnded?: boolean;
  winnerId?: string | null;
}

export interface WordValidator {
  isValid(word: string): boolean;
}

export interface FragmentProvider {
  nextFragment(minWordsPerPrompt: number): string;
}

export class GameRulesService {
  constructor(
    private readonly game: Game,
    private readonly validator: WordValidator,
    private readonly fragments: FragmentProvider,
  ) {}

  getCurrentPlayer(): Player {
    return this.game.getCurrentPlayer();
  }

  validateSubmission(playerId: string, word: string): string | null {
    const player = this.game.getCurrentPlayer();
    if (player.id !== playerId) return 'Not your turn.';
    if (word.trim().length < 2) return 'Invalid word (too short).';
    if (!word.toLowerCase().includes(this.game.fragment.toLowerCase()))
      return "Word doesn't contain the fragment.";
    if (this.game.hasWordBeenUsed(word)) return 'Word already used this game.';
    if (!this.validator.isValid(word)) return 'Not a valid word.';
    return null;
  }

  applyAcceptedWord(player: Player, word: string): void {
    // Mark as used to prevent reuse in this game
    this.game.markWordUsed(word);
    for (const letter of word) {
      player.tryBonusLetter(
        letter,
        this.game.rules.maxLives,
        this.game.rules.bonusTemplate,
      );
    }
    this.game.adjustBombTimerAfterValidWord();
  }

  advanceTurn(): void {
    this.game.nextTurn();
    this.game.setFragment(
      this.fragments.nextFragment(this.game.rules.minWordsPerPrompt),
    );
  }

  checkGameOver(): { ended: boolean; winnerId?: string } {
    const remaining = this.game.getActivePlayers();
    if (remaining.length <= 1) {
      return { ended: true, winnerId: remaining[0]?.id };
    }
    return { ended: false };
  }
}
