// Maintains last emitted snapshot per room to compute diffs for players list.
import { GameRoom } from '@game/domain/rooms/GameRoom';
import type { PlayersDiffPayload } from '@word-bomb/types';

interface PlayerLite {
  id: string;
  name: string;
  isSeated: boolean;
  isConnected?: boolean;
}

const lastSnapshots = new Map<string, PlayerLite[]>();
const lastLeaderIds = new Map<string, string | null>();

export function computePlayersDiff(room: GameRoom): PlayersDiffPayload | null {
  const prev = lastSnapshots.get(room.code) ?? [];
  const current: PlayerLite[] = room.getAllPlayers().map((p) => ({
    id: p.id,
    name: p.name,
    isSeated: p.isSeated,
    isConnected: p.isConnected,
  }));

  const prevMap = new Map(prev.map((p) => [p.id, p]));
  const currMap = new Map(current.map((p) => [p.id, p]));

  const added: PlayerLite[] = [];
  const updated: {
    id: string;
    changes: Partial<{ name: string; isSeated: boolean; isConnected: boolean }>;
  }[] = [];
  const removed: string[] = [];

  for (const p of current) {
    const before = prevMap.get(p.id);
    if (!before) {
      added.push(p);
    } else {
      const changes: Partial<{
        name: string;
        isSeated: boolean;
        isConnected: boolean;
      }> = {};
      if (before.name !== p.name) changes.name = p.name;
      if (before.isSeated !== p.isSeated) changes.isSeated = p.isSeated;
      if (before.isConnected !== p.isConnected)
        changes.isConnected = p.isConnected;
      if (Object.keys(changes).length) {
        updated.push({ id: p.id, changes });
      }
    }
  }

  for (const p of prev) {
    if (!currMap.has(p.id)) removed.push(p.id);
  }

  const leaderIdChanged = (() => {
    const last = lastLeaderIds.get(room.code) ?? null;
    const curr = room.getLeaderId();
    if (last !== curr) {
      lastLeaderIds.set(room.code, curr);
      return curr ?? '';
    }
    return undefined;
  })();

  if (
    !added.length &&
    !updated.length &&
    !removed.length &&
    leaderIdChanged === undefined
  ) {
    return null; // nothing changed
  }

  // persist snapshot
  lastSnapshots.set(room.code, current);
  if (!lastLeaderIds.has(room.code))
    lastLeaderIds.set(room.code, room.getLeaderId());

  return { added, updated, removed, leaderIdChanged };
}

export function resetPlayersDiffCache() {
  lastSnapshots.clear();
  lastLeaderIds.clear();
}
