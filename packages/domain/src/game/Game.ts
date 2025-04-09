// packages/domain/src/game/Game.ts
import { z } from "zod";
import { Player } from "../players/Player";
import { GameRoomRules, GameRulesSchema } from "../rooms/GameRoomRules";

export const GameSchema = z.object({
  roomCode: z.string().regex(/^[A-Z]{4}$/),
  players: z.array(z.instanceof(Player)),
  currentTurnIndex: z.number().int().nonnegative(),
  fragment: z.string().min(1),
  bombDuration: z.number().int().positive(), // in seconds
  state: z.enum(["active", "ended"]),
  rules: GameRulesSchema,
});

export type GameProps = z.infer<typeof GameSchema>;

export class Game {
  public readonly roomCode: string;
  public players: Player[];
  public currentTurnIndex: number;
  public fragment: string;
  public bombDuration: number;
  public state: "active" | "ended";
  public rules: GameRoomRules;

  constructor(props: GameProps) {
    const parsed = GameSchema.parse(props);
    this.roomCode = parsed.roomCode;
    this.players = parsed.players;
    this.currentTurnIndex = parsed.currentTurnIndex;
    this.fragment = parsed.fragment;
    this.bombDuration = parsed.bombDuration;
    this.state = parsed.state;
    this.rules = parsed.rules;
  }

  // Returns the active player whose turn it is.
  public getCurrentPlayer(): Player | undefined {
    const activePlayers = this.players.filter((p) => !p.isEliminated);
    if (activePlayers.length === 0) return undefined;
    // For simplicity, we assume currentTurnIndex indexes into the active players.
    return activePlayers[this.currentTurnIndex % activePlayers.length];
  }

  // Advance to the next non‑eliminated player.
  public nextTurn(): void {
    const activePlayers = this.players.filter((p) => !p.isEliminated);
    if (activePlayers.length <= 1) return;
    this.currentTurnIndex = (this.currentTurnIndex + 1) % activePlayers.length;
  }

  // Update the word fragment (could be replaced with more complex logic).
  public updateFragment(newFragment: string): void {
    this.fragment = newFragment;
  }

  // Mark the game as ended.
  public endGame(): void {
    this.state = "ended";
  }

  /**
   * Process a word submission.
   * Returns true if accepted (i.e. contains the active fragment) or false otherwise.
   */
  public submitWord(playerId: string, word: string): boolean {
    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer || currentPlayer.id !== playerId) return false; // not the player's turn.

    // Check that the word contains the fragment (case-insensitive).
    if (word.toLowerCase().includes(this.fragment.toLowerCase())) {
      for (const letter of word) {
        currentPlayer.tryBonusLetter(letter, this.rules.maxLives, this.rules.bonusTemplate);
      }
      return true;
    }
    return false;
  }
}
