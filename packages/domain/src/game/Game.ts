// packages/domain/src/game/Game.ts
import { z } from 'zod';
import { Player } from '../players/Player';
import { GameRoomRules, GameRulesSchema } from '../rooms/GameRoomRules';

export const GameSchema = z.object({
  roomCode: z.string().regex(/^[A-Z]{4}$/),
  players: z.array(z.instanceof(Player)),
  currentTurnIndex: z.number().int().nonnegative(),
  fragment: z.string().min(2).max(3),
  state: z.enum(['active', 'ended']),
  rules: GameRulesSchema,
});

export type GameProps = z.infer<typeof GameSchema>;

/** The minimum and maximum duration (in seconds) for the initial bomb timer */
export const INITIAL_BOMB_DURATION_MIN = 10;
export const INITIAL_BOMB_DURATION_MAX = 15;

/**
 * Represents the state and behavior of an active game session.
 * Tracks player turns, game state, fragment, and bomb timer logic.
 */
export class Game {
  /** The 4-letter room code identifying this game session */
  public readonly roomCode: string;

  /** The list of players currently in the game */
  public players: Player[];

  /** The index (into the list of non-eliminated players) of whose turn it is */
  public currentTurnIndex: number;

  /** The current word fragment players must use */
  public fragment: string;

  /** The current state of the game (`active` or `ended`) */
  public state: 'active' | 'ended';

  /** The ruleset the game was started with */
  public rules: GameRoomRules;

  /** The current bomb duration in seconds */
  private bombDuration: number;

  /** Tracks words that have been used in the current game (lowercased) */
  private usedWords: Set<string> = new Set<string>();

  /**
   * Constructs a new Game instance with validated initial properties.
   * @param props The validated GameProps to initialize with
   */
  constructor(props: GameProps) {
    const parsed = GameSchema.parse(props);
    this.roomCode = parsed.roomCode;
    this.players = parsed.players;
    this.currentTurnIndex = parsed.currentTurnIndex;
    this.fragment = parsed.fragment;
    this.state = parsed.state;
    this.rules = parsed.rules;
    this.bombDuration = this.rollInitialBombDuration();
  }

  /**
   * Randomly generates the initial bomb duration between
   * INITIAL_BOMB_DURATION_MIN and INITIAL_BOMB_DURATION_MAX seconds.
   * @returns A number in the range [INITIAL_BOMB_DURATION_MIN, INITIAL_BOMB_DURATION_MAX]
   */
  private rollInitialBombDuration(): number {
    const range = INITIAL_BOMB_DURATION_MAX - INITIAL_BOMB_DURATION_MIN + 1;
    return Math.floor(Math.random() * range) + INITIAL_BOMB_DURATION_MIN;
  }

  /**
   * Returns the current bomb timer duration (in seconds).
   */
  public getBombDuration(): number {
    return this.bombDuration;
  }

  /**
   * Enforces the minimum turn duration if the bomb timer has gotten too short.
   * Called after a valid word is submitted.
   */
  public adjustBombTimerAfterValidWord(): void {
    if (this.bombDuration < this.rules.minTurnDuration) {
      this.bombDuration = this.rules.minTurnDuration;
    }
  }

  /**
   * (Test-only) Force-sets the bomb duration to a fixed value.
   * @param duration The desired test value for bomb duration
   */
  public __setBombDurationForTest(duration: number): void {
    this.bombDuration = duration;
  }

  /**
   * Gets the player whose turn it currently is.
   * @returns The current (non-eliminated) player
   * @throws If no active players remain
   */
  public getCurrentPlayer(): Player {
    const active = this.players.filter((p) => !p.isEliminated);
    if (active.length === 0) {
      throw new Error('No active players remaining');
    }
    return active[this.currentTurnIndex % active.length];
  }

  /**
   * Advances the turn to the next non-eliminated player.
   * Wraps around if at the end of the list.
   */
  public nextTurn(): void {
    const active = this.players.filter((p) => !p.isEliminated);
    if (active.length > 1) {
      this.currentTurnIndex = (this.currentTurnIndex + 1) % active.length;
    }
  }

  /**
   * Updates the current fragment for the next round.
   * @param fragment The new 2–3 letter fragment
   */
  setFragment(fragment: string) {
    this.fragment = fragment;
  }

  /**
   * Returns whether the provided word has already been used in this game.
   * Matching is case-insensitive.
   */
  public hasWordBeenUsed(word: string): boolean {
    return this.usedWords.has(word.toLowerCase());
  }

  /**
   * Marks a word as used for the remainder of this game.
   * Stored case-insensitively.
   */
  public markWordUsed(word: string): void {
    this.usedWords.add(word.toLowerCase());
  }
}
