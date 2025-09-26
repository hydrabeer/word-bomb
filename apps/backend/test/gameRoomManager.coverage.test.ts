import { describe, it, expect } from 'vitest';
import { GameRoomManager } from '../src/room/GameRoomManager';
import { GameRoomRules } from '@game/domain/rooms/GameRoomRules';

const rules: GameRoomRules = {
  maxLives: 3,
  bonusTemplate: new Array(26).fill(1),
  minTurnDuration: 5,
  minWordsPerPrompt: 1,
};

describe('GameRoomManager coverage', () => {
  it('getSeatedPlayers returns only seated players and empty for missing room', () => {
    const mgr = new GameRoomManager();
    const code = 'SEAT';
    const room = mgr.create(code, rules);
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
    mgr.create('DUPL', rules);
    expect(() => mgr.create('DUPL', rules)).toThrowError(
      'Room DUPL already exists',
    );
  });
});
