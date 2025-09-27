import { z } from 'zod';

export interface GameRoomRules {
  maxLives: number;
  startingLives: number;
  bonusTemplate: number[]; // e.g. [1, 1, ..., 1]
  minTurnDuration: number;
  minWordsPerPrompt: number;
}

export const GameRulesSchema = z
  .object({
    maxLives: z.number().int().min(1).max(10),
    startingLives: z.number().int().min(1).max(10),
    bonusTemplate: z.array(z.number()).length(26),
    minTurnDuration: z.number().int().min(1).max(10),
    minWordsPerPrompt: z.number().int().min(1).max(1000),
  })
  .refine((value) => value.startingLives <= value.maxLives, {
    message: 'startingLives cannot exceed maxLives',
    path: ['startingLives'],
  });
