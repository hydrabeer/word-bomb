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

export class Game {
  public readonly roomCode: string;
  public players: Player[];
  public currentTurnIndex: number;
  public fragment: string;
  public state: 'active' | 'ended';
  public rules: GameRoomRules;
  private bombDuration: number;

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

  private rollInitialBombDuration(): number {
    return Math.floor(Math.random() * 21) + 10; // 10–30 seconds
  }

  public getBombDuration(): number {
    return this.bombDuration;
  }

  public adjustBombTimerAfterValidWord(): void {
    if (this.bombDuration < this.rules.minTurnDuration) {
      this.bombDuration = this.rules.minTurnDuration;
    }
  }

  public __setBombDurationForTest(duration: number): void {
    this.bombDuration = duration;
  }

  // Returns the active player whose turn it is.
  public getCurrentPlayer(): Player {
    const active = this.players.filter((p) => !p.isEliminated);
    if (active.length === 0) {
      throw new Error('No active players remaining');
    }
    return active[this.currentTurnIndex % active.length];
  }

  // Advance to the next non‑eliminated player.
  public nextTurn(): void {
    const active = this.players.filter((p) => !p.isEliminated);
    if (active.length > 1) {
      this.currentTurnIndex = (this.currentTurnIndex + 1) % active.length;
    }
  }

  setFragment(fragment: string) {
    this.fragment = fragment;
  }
}
