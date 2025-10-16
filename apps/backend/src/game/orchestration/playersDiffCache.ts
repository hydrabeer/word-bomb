// Maintains last emitted snapshot per room to compute diffs for players list.
import { GameRoom } from '@game/domain/rooms/GameRoom';
import type { PlayersDiffPayload } from '@word-bomb/types/socket';

interface PlayerLite {
  id: string;
  name: string;
  isSeated: boolean;
  isConnected?: boolean;
}

const lastSnapshots = new Map<string, PlayerLite[]>();
const lastLeaderIds = new Map<string, string | null>();

/**
 * Computes the minimal player diff payload for the provided room, caching the
 * latest snapshot to avoid redundant emissions.
 *
 * @param room - The room whose players should be compared against the last broadcast.
 * @returns A diff payload when changes exist, otherwise `null`.
 */
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

  const previousLeaderId = lastLeaderIds.get(room.code) ?? null;
  const currentLeaderId = room.getLeaderId();
  const leaderIdChanged =
    previousLeaderId !== currentLeaderId ? currentLeaderId : undefined;

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
  lastLeaderIds.set(room.code, currentLeaderId);

  return { added, updated, removed, leaderIdChanged };
}

/**
 * Clears all cached player snapshots so that future emissions recompute from scratch.
 */
export function resetPlayersDiffCache() {
  lastSnapshots.clear();
  lastLeaderIds.clear();
}

/**
 * Removes cached player state for a specific room, forcing a full payload next time.
 *
 * @param roomCode - Identifier of the room whose cache should be discarded.
 */
export function removePlayersDiffCacheForRoom(roomCode: string) {
  lastSnapshots.delete(roomCode);
  lastLeaderIds.delete(roomCode);
}
