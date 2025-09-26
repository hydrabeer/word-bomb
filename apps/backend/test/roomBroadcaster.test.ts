import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoomBroadcaster } from '../src/core/RoomBroadcaster';
import type { TypedServer } from '../src/socket/typedSocket';
import { GameRoom } from '@game/domain/rooms/GameRoom';
import { GameRoomRules } from '@game/domain/rooms/GameRoomRules';
import { Game } from '@game/domain/game/Game';

function makeFakeIo() {
  const toMock = vi.fn(() => fakeNamespace);
  const emitMock = vi.fn();
  const fakeNamespace = { emit: emitMock } as unknown as ReturnType<
    TypedServer['to']
  >;
  return { io: { to: toMock } as unknown as TypedServer, toMock, emitMock };
}

const rules: GameRoomRules = {
  maxLives: 3,
  bonusTemplate: new Array(26).fill(1),
  minTurnDuration: 5,
  minWordsPerPrompt: 5,
};

function buildRoomAndGame() {
  const room = new GameRoom({ code: 'ABCD' }, rules);
  room.addPlayer({ id: 'P1', name: 'Alice' });
  room.addPlayer({ id: 'P2', name: 'Bob' });
  const p1 = room.getPlayer('P1');
  const p2 = room.getPlayer('P2');
  if (!p1 || !p2) throw new Error('missing players');
  const game = new Game({
    roomCode: room.code,
    players: [p1, p2],
    currentTurnIndex: 0,
    fragment: 'ar',
    state: 'active',
    rules,
  });
  return { room, game };
}

describe('RoomBroadcaster', () => {
  let emitMock: ReturnType<typeof vi.fn>;
  // const toMock retained for potential future assertions (currently unused)
  let broadcaster: RoomBroadcaster;

  beforeEach(() => {
    const fake = makeFakeIo();
    emitMock = fake.emitMock;
    /* toMock = fake.toMock; */ broadcaster = new RoomBroadcaster(fake.io);
  });

  it('emits players snapshot and diff when diff provided', () => {
    const { room } = buildRoomAndGame();
    broadcaster.players(room, {
      added: [],
      updated: [],
      removed: [],
      leaderIdChanged: undefined,
    });
    // two emits: playersDiff + playersUpdated
    expect(emitMock).toHaveBeenCalled();
    const events: string[] = emitMock.mock.calls.map((c) => c[0] as string);
    expect(events).toContain('playersDiff');
    expect(events).toContain('playersUpdated');
  });

  it('emits only snapshot when diff omitted', () => {
    const { room } = buildRoomAndGame();
    emitMock.mockClear();
    broadcaster.players(room);
    const events: string[] = emitMock.mock.calls.map((c) => c[0] as string);
    expect(events).toEqual(['playersUpdated']);
  });

  it('emits gameStarted, turnStarted, gameEnded, playerUpdated, wordAccepted, countdown events', () => {
    const { room, game } = buildRoomAndGame();
    emitMock.mockClear();
    broadcaster.gameStarted(room, game);
    broadcaster.turnStarted(game);
    broadcaster.gameEnded(room.code, 'P1');
    broadcaster.playerUpdated(room.code, 'P1', 2);
    broadcaster.wordAccepted(room.code, 'P1', 'cargo');
    broadcaster.systemMessage(room.code, 'Hello');
    broadcaster.countdownStarted(room.code, Date.now() + 1000);
    broadcaster.countdownStopped(room.code);
    const events: string[] = emitMock.mock.calls.map((c) => c[0] as string);
    expect(events).toContain('gameStarted');
    expect(events).toContain('turnStarted');
    expect(events).toContain('gameEnded');
    expect(events).toContain('playerUpdated');
    expect(events).toContain('wordAccepted');
    expect(events).toContain('chatMessage');
    expect(events).toContain('gameCountdownStarted');
    // countdownStopped is emitted without payload via direct emit on namespace
    // verify one call without payload name differences
  });
});
