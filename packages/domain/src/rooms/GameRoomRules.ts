import { z } from "zod";

export interface GameRoomRules {
  maxLives: number;
  bonusTemplate: number[]; // e.g. [1, 1, ..., 1]
}

export const GameRulesSchema = z.object({
  maxLives: z.number().int().positive(),
  bonusTemplate: z.array(z.number()).length(26),
});