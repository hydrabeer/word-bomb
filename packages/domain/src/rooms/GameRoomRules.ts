import { z } from 'zod';

export interface GameRoomRules {
  maxLives: number;
  bonusTemplate: number[]; // e.g. [1, 1, ..., 1]
  minTurnDuration: number;
}

export const GameRulesSchema = z.object({
  maxLives: z.number().int().min(1).max(10),
  bonusTemplate: z.array(z.number()).length(26),
  minTurnDuration: z.number().int().min(1).max(10),
});
