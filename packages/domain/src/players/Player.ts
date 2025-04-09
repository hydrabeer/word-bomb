import { z } from "zod";
import { BonusProgress } from "../game/BonusProgress";

export const PlayerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(20),
  isLeader: z.boolean().default(false),
  isSeated: z.boolean().default(false),
  isEliminated: z.boolean().default(false),
  lives: z.number().int().min(0),
  bonusProgress: z.instanceof(BonusProgress),
});

export type PlayerProps = z.infer<typeof PlayerSchema>;

export class Player {
  public readonly id: string;
  public name: string;
  public isLeader: boolean;
  public isSeated: boolean;
  public isEliminated: boolean;
  public lives: number;
  public bonusProgress: BonusProgress;

  constructor(props: PlayerProps) {
    const parsed = PlayerSchema.parse(props);

    this.id = parsed.id;
    this.name = parsed.name;
    this.isLeader = parsed.isLeader;
    this.isSeated = parsed.isSeated;
    this.isEliminated = parsed.isEliminated;
    this.lives = parsed.lives;
    this.bonusProgress = parsed.bonusProgress;
  }

  eliminate(): void {
    this.isEliminated = true;
  }

  loseLife(): void {
    if (this.lives > 0) {
      this.lives--;
      if (this.lives === 0) this.eliminate();
    }
  }

  gainLife(maxLives: number): void {
    if (this.lives < maxLives) this.lives++;
  }

  tryBonusLetter(letter: string, maxLives: number, resetTemplate: number[]): boolean {
    const used = this.bonusProgress.useLetter(letter);
    if (used && this.bonusProgress.isComplete()) {
      this.gainLife(maxLives);
      this.bonusProgress.reset(resetTemplate);
      return true;
    }
    return false;
  }

  resetForNextGame(maxLives: number, resetTemplate: number[]): void {
    this.isEliminated = false;
    this.isSeated = false;
    this.lives = maxLives;
    this.bonusProgress.reset(resetTemplate);
  }
}
