import { describe, it, expect, beforeEach } from 'vitest';
import { GameRoomManager } from '../../../room/GameRoomManager';
import { GameRoomRules } from '@game/domain/rooms/GameRoomRules';
import { computePlayersDiff, resetPlayersDiffCache } from './playersDiffCache';

const rules: GameRoomRules = {
  maxLives: 3,
  startingLives: 3,
  bonusTemplate: new Array(26).fill(1),
  minTurnDuration: 5,
  minWordsPerPrompt: 1,
};

function createRoomWithPlayers(
  code: string,
  players: { id: string; name: string }[],
) {
  const mgr = new GameRoomManager();
  const room = mgr.create(code, rules);
  players.forEach((player) => room.addPlayer(player));
  return room;
}

describe('playersDiffCache', () => {
  beforeEach(() => {
    resetPlayersDiffCache();
  });

  it('returns null when no changes between consecutive calls', () => {
    const room = createRoomWithPlayers('DIFF', [
      { id: 'A', name: 'Alice' },
      { id: 'B', name: 'Bob' },
    ]);
    // first diff should show added players
    const first = computePlayersDiff(room);
    expect(first).not.toBeNull();
    // second call without modifications -> null
    const second = computePlayersDiff(room);
    expect(second).toBeNull();
  });

  it('detects updates and removals', () => {
    const room = createRoomWithPlayers('CHNG', [
      { id: 'A', name: 'Alice' },
      { id: 'B', name: 'Bob' },
    ]);
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

  it('detects name changes for existing players', () => {
    const room = createRoomWithPlayers('NAME', [
      { id: 'A', name: 'Alice' },
      { id: 'B', name: 'Bob' },
    ]);
    computePlayersDiff(room);
    const alice = room.getPlayer('A');
    if (!alice) throw new Error('missing player');
    alice.name = 'Alicia';
    const diff = computePlayersDiff(room);
    expect(diff).not.toBeNull();
    if (diff) {
      expect(diff.updated.find((u) => u.id === 'A')?.changes.name).toBe(
        'Alicia',
      );
    }
  });

  it('tracks connectivity changes without altering leader assignments', () => {
    const room = createRoomWithPlayers('NETX', [
      { id: 'A', name: 'Alice' },
      { id: 'B', name: 'Bob' },
    ]);
    computePlayersDiff(room); // establish baseline with leader A
    const alice = room.getPlayer('A');
    if (!alice) throw new Error('missing player');
    alice.isConnected = false;
    const diff = computePlayersDiff(room);
    expect(diff).not.toBeNull();
    if (diff) {
      const update = diff.updated.find((u) => u.id === 'A');
      expect(update?.changes.isConnected).toBe(false);
      expect(diff.leaderIdChanged).toBeUndefined();
    }
  });

  it('reports leader transitions including removal', () => {
    const room = createRoomWithPlayers('LEAD', [
      { id: 'A', name: 'Alice' },
      { id: 'B', name: 'Bob' },
    ]);
    computePlayersDiff(room); // establish initial snapshot
    computePlayersDiff(room); // no-op diff to prime caches

    room.removePlayer('A');
    let diff = computePlayersDiff(room);
    expect(diff).not.toBeNull();
    if (diff) {
      expect(diff.removed).toContain('A');
      expect(diff.leaderIdChanged).toBe('B');
    }

    computePlayersDiff(room); // sync cache with new leader

    room.removePlayer('B');
    diff = computePlayersDiff(room);
    expect(diff).not.toBeNull();
    if (diff) {
      expect(diff.removed).toContain('B');
      expect(diff.leaderIdChanged).toBeNull();
    }
  });
});
