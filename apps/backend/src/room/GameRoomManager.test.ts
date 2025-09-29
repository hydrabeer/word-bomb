import { describe, it, expect } from 'vitest';
import { GameRoomManager } from './GameRoomManager';
import { GameRoomRules } from '@game/domain/rooms/GameRoomRules';

describe('GameRoomManager', () => {
  it('creates and deletes rooms and enforces uniqueness', () => {
    const mgr = new GameRoomManager();
    const rules: GameRoomRules = {
      maxLives: 2,
      startingLives: 2,
      bonusTemplate: new Array(26).fill(1),
      minTurnDuration: 1,
      minWordsPerPrompt: 1,
    };
    const r = mgr.create('ABCD', rules, 'Name');
    expect(mgr.has('ABCD')).toBe(true);
    expect(mgr.get('ABCD')).toBe(r);
    // creating same code should throw
    expect(() => mgr.create('ABCD', rules)).toThrow();
    // seated players on empty room
    expect(mgr.getSeatedPlayers('ABCD')).toEqual([]);
    expect(mgr.delete('ABCD')).toBe(true);
    expect(mgr.has('ABCD')).toBe(false);
  });
});
