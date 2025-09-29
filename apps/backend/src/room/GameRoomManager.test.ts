import { describe, it, expect } from 'vitest';
import { GameRoomManager } from './GameRoomManager';
import { GameRoomRules } from '@game/domain/rooms/GameRoomRules';

const buildRules = (overrides: Partial<GameRoomRules> = {}): GameRoomRules => ({
  maxLives: 3,
  startingLives: 3,
  bonusTemplate: new Array(26).fill(1),
  minTurnDuration: 5,
  minWordsPerPrompt: 1,
  ...overrides,
});

describe('GameRoomManager', () => {
  it('creates and deletes rooms and enforces uniqueness', () => {
    const mgr = new GameRoomManager();
    const rules = buildRules({
      maxLives: 2,
      startingLives: 2,
      minTurnDuration: 1,
    });
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

  it('getSeatedPlayers returns only seated players and empty for missing room', () => {
    const mgr = new GameRoomManager();
    const code = 'SEAT';
    const room = mgr.create(code, buildRules());
    room.addPlayer({ id: 'A', name: 'Alice' });
    room.addPlayer({ id: 'B', name: 'Bob' });
    room.setPlayerSeated('A', true);
    const seated = mgr.getSeatedPlayers(code);
    expect(seated.map((p) => p.id)).toEqual(['A']);
    // unknown room
    expect(mgr.getSeatedPlayers('NONE')).toEqual([]);
  });

  it('create throws if room already exists', () => {
    const mgr = new GameRoomManager();
    mgr.create('DUPL', buildRules());
    expect(() => mgr.create('DUPL', buildRules())).toThrowError(
      'Room DUPL already exists',
    );
  });
});
