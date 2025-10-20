import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoomBroadcaster } from './RoomBroadcaster';
import type { TypedServer } from './typedSocket';
import { Game } from '@game/domain/game/Game';
import { GameRoom } from '@game/domain/rooms/GameRoom';
import type { GameRoomRules } from '@game/domain/rooms/GameRoomRules';

const logger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('../logging/context', () => ({
  getLogger: vi.fn(() => logger),
}));

function makeFakeIo() {
  const emitMock = vi.fn();
  const toMock = vi.fn(() => ({ emit: emitMock }));
  return {
    io: { to: toMock } as unknown as TypedServer,
    emitMock,
    toMock,
  };
}

const baseRules: GameRoomRules = {
  maxLives: 3,
  startingLives: 3,
  bonusTemplate: new Array(26).fill(1),
  minTurnDuration: 5,
  minWordsPerPrompt: 5,
};

function buildRoomAndGame() {
  const roomRules: GameRoomRules = {
    ...baseRules,
    bonusTemplate: [...baseRules.bonusTemplate],
  };
  const room = new GameRoom({ code: 'ABCD' }, roomRules);
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
    rules: roomRules,
  });
  return { room, game };
}

function setupBroadcaster() {
  const fake = makeFakeIo();
  return {
    broadcaster: new RoomBroadcaster(fake.io),
    emitMock: fake.emitMock,
    toMock: fake.toMock,
  };
}

describe('RoomBroadcaster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('broadcasts diff without snapshot when none requested', () => {
    const { broadcaster, emitMock, toMock } = setupBroadcaster();
    const { room } = buildRoomAndGame();

    broadcaster.players(room, {
      added: [],
      updated: [],
      removed: [],
      leaderIdChanged: undefined,
    });

    expect(toMock).toHaveBeenCalledTimes(1);
    expect(toMock).toHaveBeenCalledWith(`room:${room.code}`);
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith(
      'playersDiff',
      expect.objectContaining({ added: [], updated: [], removed: [] }),
    );
  });

  it('omits diff when no diff payload provided', () => {
    const { broadcaster, emitMock, toMock } = setupBroadcaster();
    const { room } = buildRoomAndGame();

    broadcaster.players(room);

    expect(toMock).toHaveBeenCalledWith(`room:${room.code}`);
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith(
      'playersUpdated',
      expect.objectContaining({ players: expect.any(Array) }),
    );
  });

  it('broadcasts snapshot to entire room when requested', () => {
    const { broadcaster, emitMock, toMock } = setupBroadcaster();
    const { room } = buildRoomAndGame();

    broadcaster.players(
      room,
      {
        added: [],
        updated: [],
        removed: [],
        leaderIdChanged: undefined,
      },
      { broadcastSnapshot: true },
    );

    expect(toMock).toHaveBeenNthCalledWith(1, `room:${room.code}`);
    expect(toMock).toHaveBeenNthCalledWith(2, `room:${room.code}`);
    expect(emitMock).toHaveBeenCalledTimes(2);
    expect(emitMock).toHaveBeenNthCalledWith(
      1,
      'playersDiff',
      expect.objectContaining({ added: [], updated: [], removed: [] }),
    );
    expect(emitMock).toHaveBeenNthCalledWith(
      2,
      'playersUpdated',
      expect.objectContaining({ players: expect.any(Array) }),
    );
  });

  it('sends snapshots only to targeted sockets', () => {
    const { broadcaster, emitMock, toMock } = setupBroadcaster();
    const { room } = buildRoomAndGame();

    broadcaster.players(
      room,
      {
        added: [],
        updated: [],
        removed: [],
        leaderIdChanged: undefined,
      },
      { snapshotTargets: ['sid-1', 'sid-2'] },
    );

    expect(toMock).toHaveBeenNthCalledWith(1, `room:${room.code}`);
    expect(toMock).toHaveBeenNthCalledWith(2, 'sid-1');
    expect(toMock).toHaveBeenNthCalledWith(3, 'sid-2');

    const snapshotCalls = emitMock.mock.calls.filter(
      (call) => call[0] === 'playersUpdated',
    );
    expect(snapshotCalls).toHaveLength(2);
    expect(snapshotCalls[0][1]).toEqual(
      expect.objectContaining({ players: expect.any(Array) }),
    );
  });

  it('emits rules with cloned bonus template', () => {
    const { broadcaster, emitMock, toMock } = setupBroadcaster();
    const { room } = buildRoomAndGame();

    broadcaster.rules(room);

    expect(toMock).toHaveBeenCalledWith(`room:${room.code}`);
    expect(emitMock).toHaveBeenCalledWith(
      'roomRulesUpdated',
      expect.objectContaining({
        roomCode: room.code,
        rules: expect.objectContaining({
          maxLives: baseRules.maxLives,
          bonusTemplate: expect.any(Array),
        }),
      }),
    );
    const payload = emitMock.mock.calls[0][1] as {
      rules: { bonusTemplate: number[] };
    };
    expect(payload.rules.bonusTemplate).not.toBe(room.rules.bonusTemplate);
    expect(payload.rules.bonusTemplate).toEqual(room.rules.bonusTemplate);
  });

  it('emits lifecycle events and logs informational messages', () => {
    const { broadcaster, emitMock, toMock } = setupBroadcaster();
    const { room, game } = buildRoomAndGame();

    broadcaster.gameStarted(room, game);
    broadcaster.turnStarted(game);
    broadcaster.gameEnded(room.code, 'P1');
    broadcaster.playerUpdated(room.code, 'P2', 0);
    broadcaster.wordAccepted(room.code, 'P1', 'cargo');
    broadcaster.systemMessage(room.code, 'Hello!');
    broadcaster.countdownStarted(room.code, 123);
    broadcaster.countdownStopped(room.code);

    const events = emitMock.mock.calls.map((c) => c[0]);
    expect(events).toEqual([
      'gameStarted',
      'turnStarted',
      'gameEnded',
      'playerUpdated',
      'wordAccepted',
      'chatMessage',
      'gameCountdownStarted',
      'gameCountdownStopped',
    ]);
    expect(toMock).toHaveBeenCalledTimes(events.length);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'game_started', gameId: room.code }),
      'Game started',
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'round_started',
        gameId: game.roomCode,
        playerId: game.players[0].id,
      }),
      'Round started',
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'round_ended', winnerId: 'P1' }),
      'Game ended',
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'player_eliminated', playerId: 'P2' }),
      'Player eliminated',
    );

    const chatCall = emitMock.mock.calls.find((c) => c[0] === 'chatMessage');
    expect(chatCall?.[1]).toEqual(
      expect.objectContaining({
        roomCode: room.code,
        sender: 'System',
        message: 'Hello!',
        type: 'system',
      }),
    );

    const countdownStoppedCall = emitMock.mock.calls.find(
      (c) => c[0] === 'gameCountdownStopped',
    );
    expect(countdownStoppedCall?.length).toBe(1);
  });

  it('does not log elimination when lives remain', () => {
    const { broadcaster, emitMock, toMock } = setupBroadcaster();

    broadcaster.playerUpdated('ROOM', 'P1', 2);

    expect(toMock).toHaveBeenCalledWith('room:ROOM');
    expect(emitMock).toHaveBeenCalledWith('playerUpdated', {
      playerId: 'P1',
      lives: 2,
    });
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('logs warning when measuring payload size fails but still emits', () => {
    const { broadcaster, emitMock, toMock } = setupBroadcaster();
    const cyclic: any = {};
    cyclic.self = cyclic;

    (broadcaster as any).emit('ROOM', 'playersUpdated', cyclic);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'message_out_serialize_failed',
        gameId: 'ROOM',
        type: 'playersUpdated',
      }),
      'Failed to measure payload size',
    );
    expect(toMock).toHaveBeenCalledWith('room:ROOM');
    expect(emitMock).toHaveBeenCalledWith('playersUpdated', cyclic);
  });

  it('logs warning when current player cannot be determined before payload build', () => {
    const { broadcaster, emitMock } = setupBroadcaster();
    const badGame: any = {
      roomCode: 'WARN',
      currentTurnIndex: 0,
      fragment: 'aa',
      getBombDuration: () => 1000,
      players: [
        {
          id: 'P1',
          name: 'X',
          isEliminated: false,
          lives: 1,
          getBonusProgressSnapshot: () => [],
        },
      ],
      rules: { bonusTemplate: [1] },
    };
    let callCount = 0;
    badGame.getCurrentPlayer = () => {
      callCount += 1;
      if (callCount === 1) throw new Error('no current player');
      return badGame.players[0];
    };

    expect(() => broadcaster.turnStarted(badGame)).not.toThrow();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'round_start_context_missing',
        gameId: 'WARN',
      }),
      'Unable to determine current player for round start',
    );
    expect(emitMock).toHaveBeenCalledWith(
      'turnStarted',
      expect.objectContaining({ playerId: 'P1' }),
    );
  });

  it('logs a warning when payload serialization fails before emitting', () => {
    const { broadcaster, emitMock } = setupBroadcaster();
    const cyclic: any = {};
    cyclic.self = cyclic;

    const unsafe = broadcaster as unknown as {
      emit: (roomCode: string, event: string, payload: unknown) => void;
    };

    unsafe.emit('ROOM', 'playersUpdated', cyclic);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'message_out_serialize_failed' }),
      'Failed to measure payload size',
    );
    expect(emitMock).toHaveBeenCalledWith('playersUpdated', cyclic);
  });

  it('supports measuring payloads with multiple arguments', () => {
    const { broadcaster, emitMock } = setupBroadcaster();
    const unsafe = broadcaster as unknown as {
      emit: (roomCode: string, event: string, ...payload: unknown[]) => void;
    };

    unsafe.emit('ROOM', 'playersUpdated', 'first', { second: true });

    expect(emitMock).toHaveBeenCalledWith('playersUpdated', 'first', {
      second: true,
    });
  });
});
