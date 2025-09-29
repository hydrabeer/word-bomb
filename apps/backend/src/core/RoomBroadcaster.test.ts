import { describe, it, expect } from 'vitest';
import { RoomBroadcaster } from './RoomBroadcaster';

// Minimal fake server with to(...).emit capturing
function makeIo() {
  const emitted: { room: string; event: string; args: unknown[] }[] = [];
  return {
    to: (room: string) => ({
      emit: (event: string, ...args: unknown[]) => {
        emitted.push({ room, event, args });
      },
    }),
    _emitted: emitted,
  } as any;
}

describe('RoomBroadcaster', () => {
  it('emits playersUpdated and playersDiff', () => {
    const io = makeIo();
    const b = new RoomBroadcaster(io as any);
    const room: any = {
      code: 'R1',
      rules: { bonusTemplate: [1, 2, 3] },
      getAllPlayers: () => [],
      getLeaderId: () => null,
    };
    b.players(room, { added: [], removed: [], updated: [] });
    expect(io._emitted.some((e: any) => e.event === 'playersUpdated')).toBe(
      true,
    );
    expect(io._emitted.some((e: any) => e.event === 'playersDiff')).toBe(true);
  });

  it('handles payload serialization failure gracefully', () => {
    const io = makeIo();
    const b = new RoomBroadcaster(io as any);
    const bad = {
      code: 'BAD',
      rules: { bonusTemplate: [1] },
      getAllPlayers: () => [],
    };
    // Create a cyclic object to force JSON.stringify failure when measuring payload
    const cyclic: any = {};
    cyclic.self = cyclic;
    // Force an emit with cyclic payload by directly calling private method via any cast
    (b as any).emit(bad.code, 'playersUpdated', cyclic);
    expect(io._emitted.some((e: any) => e.event === 'playersUpdated')).toBe(
      true,
    );
  });
});
