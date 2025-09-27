import { describe, it, expect } from 'vitest';
import { GameRulesSchema } from './GameRoomRules';

const validRules = {
  maxLives: 3,
  startingLives: 3,
  bonusTemplate: new Array(26).fill(1),
  minTurnDuration: 5,
  minWordsPerPrompt: 10,
};

describe('GameRulesSchema', () => {
  it('accepts valid game rules', () => {
    const result = GameRulesSchema.safeParse(validRules);
    expect(result.success).toBe(true);
  });

  it('rejects if maxLives is too low', () => {
    const result = GameRulesSchema.safeParse({
      ...validRules,
      maxLives: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects if maxLives is too high', () => {
    const result = GameRulesSchema.safeParse({
      ...validRules,
      maxLives: 11,
    });
    expect(result.success).toBe(false);
  });

  it('rejects if bonusTemplate is the wrong length', () => {
    const result = GameRulesSchema.safeParse({
      ...validRules,
      bonusTemplate: new Array(25).fill(1), // not 26
    });
    expect(result.success).toBe(false);
  });

  it('rejects if startingLives is less than 1', () => {
    const result = GameRulesSchema.safeParse({
      ...validRules,
      startingLives: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects if startingLives exceeds maxLives', () => {
    const result = GameRulesSchema.safeParse({
      ...validRules,
      startingLives: validRules.maxLives + 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects if minTurnDuration is too small', () => {
    const result = GameRulesSchema.safeParse({
      ...validRules,
      minTurnDuration: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects if minTurnDuration is too large', () => {
    const result = GameRulesSchema.safeParse({
      ...validRules,
      minTurnDuration: 11,
    });
    expect(result.success).toBe(false);
  });

  it('rejects if minWordsPerPrompt is too low', () => {
    const result = GameRulesSchema.safeParse({
      ...validRules,
      minWordsPerPrompt: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects if minWordsPerPrompt is too high', () => {
    const result = GameRulesSchema.safeParse({
      ...validRules,
      minWordsPerPrompt: 1001,
    });
    expect(result.success).toBe(false);
  });
});
