import { z } from 'zod';
import { BonusProgress } from '../game/BonusProgress';

export const PlayerSchema = z.object({
  // Accept any non-empty string for id to support transport/socket IDs.
  // (Previously enforced UUID; integration tests use Socket.IO connection ids.)
  id: z.string().min(1),
  name: z.string().min(1).max(20),
  isLeader: z.boolean().default(false),
  isSeated: z.boolean().default(false),
  isEliminated: z.boolean().default(false),
  // Whether the player currently has an active socket connection
  isConnected: z.boolean().default(true),
  lives: z.number().int().min(0),
  bonusProgress: z.instanceof(BonusProgress),
});

export type PlayerProps = z.infer<typeof PlayerSchema>;

/**
 * Represents a single player in a Word Bomb room.
 * Handles player metadata, lives, elimination, and bonus alphabet progress.
 */
export class Player {
  /** Unique identifier for the player (UUID) */
  public readonly id: string;

  /** Display name for the player */
  public name: string;

  /** Whether the player is currently the room leader */
  public isLeader: boolean;

  /** Whether the player has chosen to join the next game */
  public isSeated: boolean;

  /** Whether the player has been eliminated in the current game */
  public isEliminated: boolean;

  /** Whether this player is currently connected via websocket */
  public isConnected: boolean;

  /** Remaining lives in the current game (0 means eliminated) */
  public lives: number;

  /** Tracks bonus alphabet progress and life regeneration */
  public bonusProgress: BonusProgress;

  /**
   * Constructs a new Player instance from validated props.
   * @param props Player attributes, validated via Zod schema
   */
  constructor(props: PlayerProps) {
    const parsed = PlayerSchema.parse(props);

    this.id = parsed.id;
    this.name = parsed.name;
    this.isLeader = parsed.isLeader;
    this.isSeated = parsed.isSeated;
    this.isEliminated = parsed.isEliminated;
    this.isConnected = parsed.isConnected;
    this.lives = parsed.lives;
    this.bonusProgress = parsed.bonusProgress;
  }

  /**
   * Marks this player as eliminated from the game.
   */
  eliminate(): void {
    this.isEliminated = true;
  }

  /**
   * Decreases player's lives by 1. If they hit 0, they are eliminated.
   */
  loseLife(): void {
    if (this.lives > 0) {
      this.lives--;
      if (this.lives === 0) this.eliminate();
    }
  }

  /**
   * Increases the player's lives by 1, up to a specified maximum.
   * @param maxLives The maximum number of lives a player can have
   */
  gainLife(maxLives: number): void {
    if (this.lives < maxLives) this.lives++;
  }

  /**
   * Attempts to use a bonus letter. If the bonus alphabet is completed, gain a
   * life and reset the bonus alphabet progress.
   * @param letter The bonus letter the player submitted
   * @param maxLives The maximum number of lives a player can have
   * @param resetTemplate The new bonus progress template to apply on reset
   * @returns Whether a bonus life was earned
   */
  tryBonusLetter(
    letter: string,
    maxLives: number,
    resetTemplate: number[],
  ): boolean {
    const used = this.bonusProgress.useLetter(letter);
    if (used && this.bonusProgress.isComplete()) {
      this.gainLife(maxLives);
      this.bonusProgress.reset(resetTemplate);
      return true;
    }
    return false;
  }

  /**
   * Resets the player's state at the start of a new game.
   * @param maxLives The number of lives to restore
   * @param resetTemplate The bonus progress template to apply
   */
  resetForNextGame(maxLives: number, resetTemplate: number[]): void {
    this.isEliminated = false;
    this.isSeated = false;
    this.lives = maxLives;
    this.bonusProgress.reset(resetTemplate);
  }
}
