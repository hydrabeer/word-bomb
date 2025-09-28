import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { TypedServer, TypedSocket } from './typedSocket';
import type { BasicResponse } from '@word-bomb/types/socket';
import type { GameRoomRules } from '@game/domain/rooms/GameRoomRules';
import { registerRoomHandlers } from './roomHandlers';
import { socketRoomId } from '../utils/socketRoomId';

vi.mock('../room/roomManagerSingleton', () => ({
  roomManager: {
    get: vi.fn(),
    has: vi.fn(),
    create: vi.fn(),
    clear: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../game/orchestration/emitPlayers', () => ({
  emitPlayers: vi.fn(),
}));

vi.mock('../game/orchestration/startGameForRoom', () => ({
  startGameForRoom: vi.fn(),
}));

vi.mock('../game/engineRegistry', () => ({
  getGameEngine: vi.fn(),
  deleteGameEngine: vi.fn(),
}));

const systemMessageMock = vi.fn();
const broadcastRulesMock = vi.fn();

vi.mock('../core/RoomBroadcaster', () => ({
  RoomBroadcaster: vi.fn().mockImplementation(() => ({
    systemMessage: systemMessageMock,
    rules: broadcastRulesMock,
  })),
}));

const { roomManager } = await import('../room/roomManagerSingleton');
const { emitPlayers } = await import('../game/orchestration/emitPlayers');
const { getGameEngine } = await import('../game/engineRegistry');

type Fn<A extends unknown[] = unknown[], R = unknown> = (...args: A) => R;
type MockFn<A extends unknown[] = unknown[], R = unknown> = Mock<Fn<A, R>>;

interface PlayerState {
  id: string;
  name: string;
  isSeated: boolean;
  isConnected: boolean;
}

interface MockRoom {
  code: string;
  rules: GameRoomRules;
  hasPlayer: MockFn<[string], boolean>;
  addPlayer: MockFn<[PlayerState], void>;
  getPlayer: MockFn<[string], PlayerState | undefined>;
  removePlayer: MockFn<[string], void>;
  setPlayerConnected: MockFn<[string, boolean], void>;
  setPlayerSeated: MockFn<[string, boolean], void>;
  getAllPlayers: MockFn<[], PlayerState[]>;
  isGameTimerRunning: MockFn<[], boolean>;
  startGameStartTimer: MockFn<[callback: () => void, delayMs: number], void>;
  cancelGameStartTimer: MockFn<[], void>;
  updateRules: MockFn<[GameRoomRules], void>;
  getLeaderId: MockFn<[], string | undefined>;
  game?: {
    getCurrentPlayer: () => PlayerState;
    started?: boolean;
  };
  withLeader(id: string): void;
  triggerTimer(): void;
}

interface CreateRoomOptions {
  code?: string;
  players?: PlayerState[];
  rules?: GameRoomRules;
  leaderId?: string;
  game?: {
    getCurrentPlayer: () => PlayerState;
  };
}

function createMockRoom(options: CreateRoomOptions = {}): MockRoom {
  const players = new Map<string, PlayerState>();
  for (const player of options.players ?? []) {
    players.set(player.id, { ...player });
  }

  let timerRunning = false;
  let timerCallback: (() => void) | undefined;
  let leaderId = options.leaderId;
  const rules: GameRoomRules =
    options.rules ??
    ({
      maxLives: 3,
      startingLives: 3,
      bonusTemplate: Array.from({ length: 26 }, () => 1),
      minTurnDuration: 5,
      minWordsPerPrompt: 500,
    } satisfies GameRoomRules);

  const room: MockRoom = {
    code: options.code ?? 'ROOM',
    rules,
    hasPlayer: vi.fn((id: string) => players.has(id)),
    addPlayer: vi.fn((player: PlayerState) => {
      players.set(player.id, { ...player, isSeated: false, isConnected: true });
    }),
    getPlayer: vi.fn((id: string) => players.get(id)),
    removePlayer: vi.fn((id: string) => {
      players.delete(id);
    }),
    setPlayerConnected: vi.fn((id: string, connected: boolean) => {
      const existing = players.get(id);
      if (existing) existing.isConnected = connected;
    }),
    setPlayerSeated: vi.fn((id: string, seated: boolean) => {
      const existing = players.get(id);
      if (existing) existing.isSeated = seated;
    }),
    getAllPlayers: vi.fn(() => Array.from(players.values())),
    isGameTimerRunning: vi.fn(() => timerRunning),
    startGameStartTimer: vi.fn((cb: () => void, _delay: number) => {
      void _delay;
      timerRunning = true;
      timerCallback = cb;
    }),
    cancelGameStartTimer: vi.fn(() => {
      timerRunning = false;
      timerCallback = undefined;
    }),
    updateRules: vi.fn((nextRules: GameRoomRules) => {
      room.rules = nextRules;
    }),
    getLeaderId: vi.fn(() => leaderId),
    game: options.game,
    withLeader(id: string) {
      leaderId = id;
    },
    triggerTimer() {
      timerCallback?.();
    },
  };

  return room;
}

class FakeSocket {
  public readonly id: string;
  public readonly data: Record<string, unknown> = {};
  public readonly emitted: { event: string; payload: unknown }[] = [];
  public readonly joinedRooms: string[] = [];
  public readonly leftRooms: string[] = [];
  private readonly handlers = new Map<
    string,
    (...args: unknown[]) => unknown
  >();

  constructor(id: string) {
    this.id = id;
  }

  on(event: string, handler: (...args: unknown[]) => unknown): this {
    this.handlers.set(event, handler);
    return this;
  }

  emit(event: string, payload?: unknown): this {
    this.emitted.push({ event, payload });
    return this;
  }

  join(room: string): Promise<void> {
    this.joinedRooms.push(room);
    return Promise.resolve();
  }

  leave(room: string): Promise<void> {
    this.leftRooms.push(room);
    return Promise.resolve();
  }

  getHandler(event: string) {
    const handler = this.handlers.get(event);
    if (!handler) {
      throw new Error(`Handler ${event} was not registered`);
    }
    return handler;
  }
}

class FakeIo {
  public readonly targeted: {
    room: string;
    event: string;
    payload: unknown;
  }[] = [];

  to(room: string) {
    return {
      emit: (event: string, payload: unknown) => {
        this.targeted.push({ room, event, payload });
      },
    };
  }
}

function setupHarness(room?: MockRoom) {
  const io = new FakeIo();
  const socket = new FakeSocket('socket-1');
  (
    roomManager.get as MockFn<[string], MockRoom | undefined>
  ).mockImplementation((code: string) => {
    if (room && code === room.code) {
      return room;
    }
    return undefined;
  });

  registerRoomHandlers(
    io as unknown as TypedServer,
    socket as unknown as TypedSocket,
  );

  return {
    io,
    socket,
    getJoinHandler: () =>
      socket.getHandler('joinRoom') as (
        raw: unknown,
        cb?: (res: BasicResponse) => void,
      ) => void,
    getSetSeatedHandler: () =>
      socket.getHandler('setPlayerSeated') as (
        raw: unknown,
        cb?: (res: BasicResponse) => void,
      ) => void,
    getSubmitHandler: () =>
      socket.getHandler('submitWord') as (
        raw: unknown,
        cb?: (res: BasicResponse) => void,
      ) => void,
    getUpdateRulesHandler: () =>
      socket.getHandler('updateRoomRules') as (
        raw: unknown,
        cb?: (res: BasicResponse) => void,
      ) => void,
  };
}

describe('registerRoomHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects joinRoom with invalid payload', () => {
    const { getJoinHandler } = setupHarness();
    const callback = vi.fn();

    getJoinHandler()({ invalid: true }, callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid payload',
    });
    const roomGetMock = roomManager.get as unknown as ReturnType<typeof vi.fn>;
    expect(roomGetMock).not.toHaveBeenCalled();
  });

  it('rejects joinRoom when name is invalid', () => {
    const room = createMockRoom({ code: 'ABCD' });
    const { getJoinHandler } = setupHarness(room);
    const callback = vi.fn();

    getJoinHandler()({ roomCode: 'ABCD', playerId: 'P1', name: '' }, callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid player name',
    });
    const roomGetMock2 = roomManager.get as unknown as ReturnType<typeof vi.fn>;
    expect(roomGetMock2).not.toHaveBeenCalled();
  });

  it('joins room, adds player, and emits rules snapshot', () => {
    const room = createMockRoom({ code: 'WXYZ' });
    room.hasPlayer.mockReturnValue(false);
    const { socket, io, getJoinHandler } = setupHarness(room);
    const callback = vi.fn();

    getJoinHandler()(
      { roomCode: 'WXYZ', playerId: 'P1', name: 'Alice' },
      callback,
    );

    expect(room.addPlayer).toHaveBeenCalledWith({
      id: 'P1',
      name: 'Alice',
    });
    expect(socket.joinedRooms).toContain(socketRoomId('WXYZ'));
    expect(socket.data.currentRoomCode).toBe('WXYZ');
    expect(socket.data.currentPlayerId).toBe('P1');
    expect(callback).toHaveBeenCalledWith({ success: true });
    expect(systemMessageMock).toHaveBeenCalledWith(
      'WXYZ',
      'Alice joined the room.',
    );
    expect(emitPlayers).toHaveBeenCalledWith(expect.anything(), room);
    const rulesEvent = socket.emitted.find(
      (evt) => evt.event === 'roomRulesUpdated',
    );
    expect(rulesEvent?.payload).toMatchObject({
      roomCode: 'WXYZ',
      rules: {
        bonusTemplate: expect.any(Array),
      },
    });
    expect(io.targeted).toEqual([]);
  });

  it('starts countdown when second player becomes seated', () => {
    const room = createMockRoom({
      code: 'ROOM',
      players: [
        { id: 'A', name: 'Alpha', isSeated: true, isConnected: true },
        { id: 'B', name: 'Bravo', isSeated: false, isConnected: true },
      ],
    });
    room.hasPlayer.mockReturnValue(true);
    room.isGameTimerRunning.mockReturnValue(false);
    const { io, getSetSeatedHandler } = setupHarness(room);

    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    getSetSeatedHandler()(
      { roomCode: 'ROOM', playerId: 'B', seated: true },
      vi.fn(),
    );

    expect(room.setPlayerSeated).toHaveBeenCalledWith('B', true);
    expect(room.startGameStartTimer).toHaveBeenCalled();
    const countdown = io.targeted.find(
      (entry) => entry.event === 'gameCountdownStarted',
    );
    expect(countdown?.room).toBe(socketRoomId('ROOM'));
    expect(countdown?.payload).toEqual({ deadline: Date.now() + 15000 });
  });

  it('cancels countdown when seated players drop below two', () => {
    const room = createMockRoom({
      code: 'ROOM',
      players: [
        { id: 'A', name: 'Alpha', isSeated: true, isConnected: true },
        { id: 'B', name: 'Bravo', isSeated: true, isConnected: true },
      ],
    });
    room.hasPlayer.mockReturnValue(true);
    room.isGameTimerRunning.mockReturnValue(true);
    const { io, getSetSeatedHandler } = setupHarness(room);

    getSetSeatedHandler()(
      { roomCode: 'ROOM', playerId: 'B', seated: false },
      vi.fn(),
    );

    expect(room.cancelGameStartTimer).toHaveBeenCalled();
    const stopped = io.targeted.find(
      (entry) => entry.event === 'gameCountdownStopped',
    );
    expect(stopped?.room).toBe(socketRoomId('ROOM'));
  });

  it('acknowledges submitWord failure when room missing', () => {
    const { socket, getSubmitHandler } = setupHarness();
    const callback = vi.fn();

    getSubmitHandler()(
      {
        roomCode: 'NONE',
        playerId: 'P1',
        word: 'alpha',
        clientActionId: 'action-1',
      },
      callback,
    );

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'Room not found',
    });
    const ack = socket.emitted.find((evt) => evt.event === 'actionAck');
    expect(ack?.payload).toEqual({
      clientActionId: 'action-1',
      success: false,
      error: 'Room not found',
    });
  });

  it('emits actionAck with engine result on submitWord', () => {
    const room = createMockRoom({ code: 'ROOM' });
    room.hasPlayer.mockReturnValue(true);
    const current: PlayerState = {
      id: 'P1',
      name: 'Alpha',
      isSeated: true,
      isConnected: true,
    };
    room.game = {
      getCurrentPlayer: () => current,
    };
    (getGameEngine as MockFn<[string]>).mockReturnValue({
      submitWord: vi.fn(() => ({ success: true })),
    });
    const { socket, getSubmitHandler } = setupHarness(room);
    const callback = vi.fn();

    getSubmitHandler()(
      {
        roomCode: 'ROOM',
        playerId: 'P1',
        word: 'alpha',
        clientActionId: 'ack-1',
      },
      callback,
    );

    expect(callback).toHaveBeenCalledWith({ success: true });
    const ack = socket.emitted.find((evt) => evt.event === 'actionAck');
    expect(ack?.payload).toEqual({
      clientActionId: 'ack-1',
      success: true,
      error: undefined,
    });
  });

  it('rejects updateRoomRules from non-leader', () => {
    const room = createMockRoom({ code: 'ROOM', leaderId: 'leader' });
    room.getLeaderId.mockReturnValue('leader');
    const { getUpdateRulesHandler, socket } = setupHarness(room);
    socket.data.currentRoomCode = 'ROOM';
    socket.data.currentPlayerId = 'member';
    const callback = vi.fn();

    getUpdateRulesHandler()(
      {
        roomCode: 'ROOM',
        rules: room.rules,
      },
      callback,
    );

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'Only the leader can change rules.',
    });
    expect(room.updateRules).not.toHaveBeenCalled();
  });

  it('updates room rules when leader submits valid payload', () => {
    const room = createMockRoom({ code: 'ROOM', leaderId: 'leader' });
    const { getUpdateRulesHandler, socket } = setupHarness(room);
    socket.data.currentRoomCode = 'ROOM';
    socket.data.currentPlayerId = 'leader';
    const callback = vi.fn();
    const nextRules: GameRoomRules = {
      maxLives: 4,
      startingLives: 3,
      bonusTemplate: Array.from({ length: 26 }, (_, idx) => (idx % 2) + 1),
      minTurnDuration: 4,
      minWordsPerPrompt: 250,
    };

    getUpdateRulesHandler()(
      {
        roomCode: 'ROOM',
        rules: nextRules,
      },
      callback,
    );

    expect(room.updateRules).toHaveBeenCalledWith(nextRules);
    expect(broadcastRulesMock).toHaveBeenCalledWith(room);
    expect(systemMessageMock).toHaveBeenCalledWith(
      'ROOM',
      'Leader updated the room rules.',
    );
    expect(callback).toHaveBeenCalledWith({ success: true });
  });
});
