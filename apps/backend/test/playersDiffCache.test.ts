import { describe, it, expect, beforeEach } from 'vitest';
import { GameRoomManager } from '../src/room/GameRoomManager';
import { GameRoomRules } from '@game/domain/rooms/GameRoomRules';
import {
  computePlayersDiff,
  resetPlayersDiffCache,
} from '../src/game/orchestration/playersDiffCache';

const rules: GameRoomRules = {
  maxLives: 3,
  startingLives: 3,
  bonusTemplate: new Array(26).fill(1),
  minTurnDuration: 5,
  minWordsPerPrompt: 1,
};

function createRoom(code: string) {
  const mgr = new GameRoomManager();
  const room = mgr.create(code, rules);
  room.addPlayer({ id: 'A', name: 'Alice' });
  room.addPlayer({ id: 'B', name: 'Bob' });
  return room;
}

describe('playersDiffCache', () => {
  beforeEach(() => {
    resetPlayersDiffCache();
  });

  it('returns null when no changes between consecutive calls', () => {
    const room = createRoom('DIFF');
    // first diff should show added players
    const first = computePlayersDiff(room);
    expect(first).not.toBeNull();
    // second call without modifications -> null
    const second = computePlayersDiff(room);
    expect(second).toBeNull();
  });

  it('detects updates and removals', () => {
    const room = createRoom('CHNG');
    computePlayersDiff(room); // establish baseline
    // update
    const alice = room.getPlayer('A');
    if (alice) alice.isSeated = true;
    // remove Bob
    room.removePlayer('B');
    const diff = computePlayersDiff(room);
    expect(diff).not.toBeNull();
    if (diff) {
      expect(diff.updated.find((u) => u.id === 'A')?.changes.isSeated).toBe(
        true,
      );
      expect(diff.removed).toContain('B');
    }
  });
});
