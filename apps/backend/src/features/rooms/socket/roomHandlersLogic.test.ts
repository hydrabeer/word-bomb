import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type {
  TypedServer,
  TypedSocket,
} from '../../../platform/socket/typedSocket';
import type { BasicResponse } from '@word-bomb/types/socket';
import type { GameRoomRules } from '@game/domain/rooms/GameRoomRules';
import { registerRoomHandlers } from './roomHandlers';
import { socketRoomId } from '../../../shared/utils/socketRoomId';

vi.mock('../app/roomManagerSingleton', () => ({
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

vi.mock('../game/orchestration/playersDiffCache', () => ({
  removePlayersDiffCacheForRoom: vi.fn(),
}));

vi.mock('@game/domain/chat/ChatMessage', () => ({
  toAuthoritativeChatMessage: vi.fn((raw: unknown) => raw as any),
}));

const systemMessageMock = vi.fn();
const broadcastRulesMock = vi.fn();

vi.mock('../core/RoomBroadcaster', () => ({
  RoomBroadcaster: vi.fn().mockImplementation(() => ({
    systemMessage: systemMessageMock,
    rules: broadcastRulesMock,
  })),
}));

const { roomManager } = await import('../app/roomManagerSingleton');
const { emitPlayers } = await import('../../gameplay/app/emitPlayers');
const { getGameEngine } = await import('../../gameplay/engine/engineRegistry');
const { startGameForRoom } = await import(
  '../../gameplay/app/startGameForRoom'
);
const { toAuthoritativeChatMessage } = await import(
  '@game/domain/chat/ChatMessage'
);
const serialization = await import('../../../platform/socket/serialization');
const { getLogger } = await import('../../../platform/logging/context');

const roomManagerMock = vi.mocked(roomManager);
const startGameForRoomMock = vi.mocked(startGameForRoom);

type Fn<A extends unknown[] = unknown[], R = unknown> = (...args: A) => R;
type MockFn<A extends unknown[] = unknown[], R = unknown> = Mock<Fn<A, R>>;

interface PlayerState {
  id: string;
  name: string;
  isSeated: boolean;
  isConnected: boolean;
  isEliminated?: boolean;
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
    getLeaveHandler: () =>
      socket.getHandler('leaveRoom') as (raw: unknown) => void,
    getSetSeatedHandler: () =>
      socket.getHandler('setPlayerSeated') as (
        raw: unknown,
        cb?: (res: BasicResponse) => void,
      ) => void,
    getPlayerTypingHandler: () =>
      socket.getHandler('playerTyping') as (raw: unknown) => void,
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
    getStartHandler: () =>
      socket.getHandler('startGame') as (
        raw: unknown,
        cb?: (res: BasicResponse) => void,
      ) => void,
    getChatHandler: () =>
      socket.getHandler('chatMessage') as (raw: unknown) => void,
    getDisconnectHandler: () => socket.getHandler('disconnect') as () => void,
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

  it('normalizes non-string names before validating join payloads', () => {
    const room = createMockRoom({ code: 'NSTR' });
    const { getJoinHandler } = setupHarness(room);
    const callback = vi.fn();

    getJoinHandler()(
      { roomCode: 'NSTR', playerId: 'P1', name: 123 } as any,
      callback,
    );

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid player name',
    });
    expect(roomManager.get).not.toHaveBeenCalled();
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

  it('ignores cleanup when previous room is already gone', () => {
    const room = createMockRoom({ code: 'ROOM' });
    room.hasPlayer.mockReturnValue(false);
    const { getJoinHandler, socket } = setupHarness(room);
    socket.data.currentRoomCode = 'OLD';
    const callback = vi.fn();

    getJoinHandler()(
      { roomCode: 'ROOM', playerId: 'P1', name: 'Alice' },
      callback,
    );

    expect(callback).toHaveBeenCalledWith({ success: true });
  });

  it('uses fallback names when leaving a previous room without player info', () => {
    const room = createMockRoom({ code: 'NEWR' });
    room.hasPlayer.mockReturnValue(false);
    const oldRoom = createMockRoom({ code: 'OLD' });
    oldRoom.hasPlayer.mockReturnValue(true);
    oldRoom.getPlayer.mockReturnValue(undefined);
    const { getJoinHandler, socket } = setupHarness(room);
    const getMock = roomManager.get as MockFn<[string], MockRoom | undefined>;
    getMock.mockImplementation((code: string) => {
      if (code === 'NEWR') return room;
      if (code === 'OLD') return oldRoom;
      return undefined;
    });
    socket.data.currentRoomCode = 'OLD';
    const callback = vi.fn();

    getJoinHandler()(
      { roomCode: 'NEWR', playerId: 'P1', name: 'Alice' },
      callback,
    );

    expect(callback).toHaveBeenCalledWith({ success: true });
    expect(oldRoom.removePlayer).toHaveBeenCalledWith('P1');
    const messages = systemMessageMock.mock.calls.map((call) => call.join(' '));
    expect(messages.some((msg) => msg.includes('Someone left the room.'))).toBe(
      true,
    );
  });

  it('reconnects players even when stored record is missing', () => {
    const room = createMockRoom({ code: 'RECN' });
    room.hasPlayer.mockReturnValue(true);
    room.getPlayer.mockReturnValue(undefined);
    const { getJoinHandler, socket } = setupHarness(room);
    socket.data.currentRoomCode = 'RECN';
    const callback = vi.fn();

    getJoinHandler()(
      { roomCode: 'RECN', playerId: 'P1', name: 'Alice' },
      callback,
    );

    expect(room.setPlayerConnected).toHaveBeenCalledWith('P1', true);
    expect(callback).toHaveBeenCalledWith({ success: true });
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

  it('submitWord rejects payloads with non-string words', () => {
    const { getSubmitHandler } = setupHarness();
    const callback = vi.fn();

    getSubmitHandler()(
      {
        roomCode: 'ROOM',
        playerId: 'P1',
        word: 123,
      } as any,
      callback,
    );

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid payload',
    });
  });

  it('submitWord rejects payloads with non-string player ids', () => {
    const { getSubmitHandler } = setupHarness();
    const callback = vi.fn();

    getSubmitHandler()(
      {
        roomCode: 'ROOM',
        playerId: 42,
        word: 'alpha',
      } as any,
      callback,
    );

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid payload',
    });
  });

  it('submitWord rejects non-object payloads', () => {
    const { getSubmitHandler } = setupHarness();
    const callback = vi.fn();

    getSubmitHandler()(null, callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid payload',
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

  it('returns error when joinRoom handler encounters unexpected failure', () => {
    const room = createMockRoom({ code: 'ROOM' });
    room.hasPlayer.mockReturnValue(false);
    room.addPlayer.mockImplementation(() => {
      throw new Error('join failed');
    });
    const { getJoinHandler } = setupHarness(room);
    const callback = vi.fn();

    getJoinHandler()(
      { roomCode: 'ROOM', playerId: 'P1', name: 'Alice' },
      callback,
    );

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'join failed',
    });
  });

  it('swallows serialization errors when emitting existing game snapshots', () => {
    const room = createMockRoom({
      code: 'ROOM',
      players: [{ id: 'P1', name: 'Alpha', isSeated: true, isConnected: true }],
      game: {
        getCurrentPlayer: () => ({
          id: 'P1',
          name: 'Alpha',
          isSeated: true,
          isConnected: true,
        }),
      },
    });
    room.hasPlayer.mockReturnValue(true);
    const gamePayloadSpy = vi
      .spyOn(serialization, 'buildGameStartedPayload')
      .mockImplementationOnce(() => {
        throw new Error('serialize');
      });
    const { getJoinHandler } = setupHarness(room);

    expect(() =>
      getJoinHandler()(
        { roomCode: 'ROOM', playerId: 'P1', name: 'Alpha' },
        vi.fn(),
      ),
    ).not.toThrow();

    gamePayloadSpy.mockRestore();
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

  it('continues cleanup even when cancelGameStartTimer throws', () => {
    const room = createMockRoom({
      code: 'ROOM',
      players: [{ id: 'P1', name: 'Alpha', isSeated: true, isConnected: true }],
    });
    room.cancelGameStartTimer.mockImplementation(() => {
      throw new Error('stop fail');
    });
    const deleteMock = roomManagerMock.delete;
    const { getLeaveHandler } = setupHarness(room);

    expect(() =>
      getLeaveHandler()({ roomCode: 'ROOM', playerId: 'P1' }),
    ).not.toThrow();
    expect(deleteMock).toHaveBeenCalledWith('ROOM');
  });

  it('ignores leaveRoom when room does not exist', () => {
    const { getLeaveHandler } = setupHarness();
    expect(() =>
      getLeaveHandler()({ roomCode: 'NONE', playerId: 'P1' }),
    ).not.toThrow();
  });

  it('ignores leaveRoom when player is not in the room', () => {
    const room = createMockRoom({ code: 'ROOM' });
    room.getPlayer.mockReturnValue(undefined);
    const { getLeaveHandler } = setupHarness(room);

    expect(() =>
      getLeaveHandler()({ roomCode: 'ROOM', playerId: 'P1' }),
    ).not.toThrow();
  });

  it('cleanupRoomIfEmpty exits quietly when room already deleted', () => {
    const room = createMockRoom({
      code: 'ROOM',
      players: [
        { id: 'P1', name: 'Alpha', isSeated: false, isConnected: true },
      ],
    });
    const { getLeaveHandler } = setupHarness(room);
    const getMock = roomManager.get as MockFn<[string], MockRoom | undefined>;
    getMock.mockImplementationOnce((code) =>
      code === 'ROOM' ? room : undefined,
    );
    getMock.mockImplementationOnce(() => undefined);

    expect(() =>
      getLeaveHandler()({ roomCode: 'ROOM', playerId: 'P1' }),
    ).not.toThrow();
  });

  it('handles chatMessage parser failures gracefully', () => {
    const { getChatHandler } = setupHarness();
    (
      toAuthoritativeChatMessage as MockFn<[unknown], unknown>
    ).mockImplementationOnce(() => {
      throw new Error('bad message');
    });

    expect(() => getChatHandler()({})).not.toThrow();
  });

  it('setPlayerSeated returns error when room is missing', () => {
    const { getSetSeatedHandler } = setupHarness();
    const callback = vi.fn();

    getSetSeatedHandler()(
      { roomCode: 'ROOM', playerId: 'P1', seated: true },
      callback,
    );

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'Room not found',
    });
  });

  it('setPlayerSeated rejects payloads without string identifiers', () => {
    const { getSetSeatedHandler } = setupHarness();
    const callback = vi.fn();

    getSetSeatedHandler()(
      { roomCode: 123, playerId: 'P1', seated: true } as any,
      callback,
    );

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid payload',
    });
  });

  it('setPlayerSeated rejects payloads with non-string player ids', () => {
    const { getSetSeatedHandler } = setupHarness();
    const callback = vi.fn();

    getSetSeatedHandler()(
      { roomCode: 'ROOM', playerId: 123, seated: true } as any,
      callback,
    );

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid payload',
    });
  });

  it('setPlayerSeated rejects non-object payloads', () => {
    const { getSetSeatedHandler } = setupHarness();
    const callback = vi.fn();

    getSetSeatedHandler()(null, callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid payload',
    });
  });

  it('logs auto-start errors when startGameForRoom throws during countdown', () => {
    const room = createMockRoom({
      code: 'ROOM',
      players: [
        { id: 'A', name: 'Alpha', isSeated: true, isConnected: true },
        { id: 'B', name: 'Bravo', isSeated: false, isConnected: true },
      ],
    });
    room.hasPlayer.mockReturnValue(true);
    room.isGameTimerRunning.mockReturnValue(false);
    const { getSetSeatedHandler } = setupHarness(room);
    const logger = getLogger();
    const errorSpy = vi.spyOn(logger, 'error');
    startGameForRoomMock.mockImplementationOnce(() => {
      throw new Error('auto-start');
    });

    getSetSeatedHandler()(
      { roomCode: 'ROOM', playerId: 'B', seated: true },
      vi.fn(),
    );
    room.triggerTimer();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'auto_start_error', gameId: 'ROOM' }),
      'Auto start failed',
    );
    errorSpy.mockRestore();

    startGameForRoomMock.mockReset();
  });

  it('startGame returns error when room is missing', () => {
    const { getStartHandler } = setupHarness();
    const callback = vi.fn();

    getStartHandler()({ roomCode: 'ROOM' }, callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'Room not found',
    });
  });

  it('startGame reports failures thrown by startGameForRoom', () => {
    const room = createMockRoom({
      code: 'ROOM',
      players: [
        { id: 'A', name: 'Alpha', isSeated: true, isConnected: true },
        { id: 'B', name: 'Bravo', isSeated: true, isConnected: true },
      ],
    });
    room.hasPlayer.mockReturnValue(true);
    startGameForRoomMock.mockImplementationOnce(() => {
      throw new Error('start failed');
    });
    const { getStartHandler } = setupHarness(room);
    const callback = vi.fn();

    getStartHandler()({ roomCode: 'ROOM' }, callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'start failed',
    });

    startGameForRoomMock.mockReset();
  });

  it('startGame rejects payloads missing a valid room code', () => {
    const { getStartHandler } = setupHarness();
    const callback = vi.fn();

    getStartHandler()({ roomCode: 123 } as any, callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid payload',
    });
  });

  it('startGame rejects non-object payloads', () => {
    const { getStartHandler } = setupHarness();
    const callback = vi.fn();

    getStartHandler()(null, callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid payload',
    });
  });

  it('playerTyping ignores invalid payloads entirely', () => {
    const { getPlayerTypingHandler } = setupHarness();
    const handler = getPlayerTypingHandler();
    expect(() => handler(null)).not.toThrow();
    expect(roomManager.get).not.toHaveBeenCalled();
  });

  it('playerTyping exits when room has no active game', () => {
    const room = createMockRoom({
      code: 'ROOM',
      players: [{ id: 'P1', name: 'Alpha', isSeated: true, isConnected: true }],
    });
    const { getPlayerTypingHandler } = setupHarness(room);
    const handler = getPlayerTypingHandler();
    handler({ roomCode: 'ROOM', playerId: 'P1', input: 'a' });
    expect(roomManager.get).toHaveBeenCalledWith('ROOM');
  });

  it('playerTyping ignores updates when not the current player', () => {
    const room = createMockRoom({
      code: 'ROOM',
      players: [{ id: 'P1', name: 'Alpha', isSeated: true, isConnected: true }],
      game: {
        getCurrentPlayer: () => ({ id: 'OTHER' }) as any,
      },
    });
    const { getPlayerTypingHandler, io } = setupHarness(room);
    const handler = getPlayerTypingHandler();
    handler({ roomCode: 'ROOM', playerId: 'P1', input: 'hmm' });
    expect(io.targeted).toHaveLength(0);
  });

  it('playerTyping emits update when current player types', () => {
    const room = createMockRoom({
      code: 'ROOM',
      players: [{ id: 'P1', name: 'Alpha', isSeated: true, isConnected: true }],
      game: {
        getCurrentPlayer: () => ({ id: 'P1' }) as any,
      },
    });
    const { getPlayerTypingHandler, io } = setupHarness(room);
    const handler = getPlayerTypingHandler();
    handler({ roomCode: 'ROOM', playerId: 'P1', input: 'text' });
    expect(io.targeted).toContainEqual({
      room: socketRoomId('ROOM'),
      event: 'playerTypingUpdate',
      payload: { playerId: 'P1', input: 'text' },
    });
  });

  it('playerTyping normalizes non-string input to empty string', () => {
    const room = createMockRoom({
      code: 'ROOM',
      players: [{ id: 'P1', name: 'Alpha', isSeated: true, isConnected: true }],
      game: {
        getCurrentPlayer: () => ({ id: 'P1' }) as any,
      },
    });
    const { getPlayerTypingHandler, io } = setupHarness(room);
    const handler = getPlayerTypingHandler();
    handler({ roomCode: 'ROOM', playerId: 'P1', input: 42 } as any);
    expect(io.targeted).toContainEqual({
      room: socketRoomId('ROOM'),
      event: 'playerTypingUpdate',
      payload: { playerId: 'P1', input: '' },
    });
  });

  it('disconnect handler exits when player id is missing', () => {
    const room = createMockRoom({ code: 'ROOM' });
    const { getDisconnectHandler, socket } = setupHarness(room);
    socket.data.currentRoomCode = 'ROOM';

    expect(() => getDisconnectHandler()()).not.toThrow();
    expect(room.setPlayerConnected).not.toHaveBeenCalled();
  });

  it('disconnect timeout skips removal when room no longer exists', () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    const room = createMockRoom({
      code: 'ROOM',
      players: [{ id: 'P1', name: 'Alpha', isSeated: true, isConnected: true }],
    });
    room.hasPlayer.mockReturnValue(true);
    room.getPlayer.mockReturnValue({
      id: 'P1',
      name: 'Alpha',
      isSeated: true,
      isConnected: true,
      isEliminated: false,
    });
    const { getDisconnectHandler, socket } = setupHarness(room);
    socket.data.currentRoomCode = 'ROOM';
    socket.data.currentPlayerId = 'P1';

    const getMock = roomManager.get as MockFn<[string], MockRoom | undefined>;
    getMock.mockImplementationOnce((code) =>
      code === 'ROOM' ? room : undefined,
    );
    getMock.mockImplementation(() => undefined);

    try {
      getDisconnectHandler()();
      expect(room.setPlayerConnected).toHaveBeenCalledWith('P1', false);
      vi.runAllTimers();
      expect(room.removePlayer).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('disconnect timeout removes player and forfeits when still disconnected', () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    const room = createMockRoom({
      code: 'ROOM',
      players: [{ id: 'P1', name: 'Alpha', isSeated: true, isConnected: true }],
    });
    const engine = { forfeitPlayer: vi.fn() };
    (
      getGameEngine as MockFn<[string], typeof engine | undefined>
    ).mockReturnValue(engine);
    room.game = {
      getCurrentPlayer: () => ({ id: 'P1', name: 'Alpha' }) as any,
      started: true,
    } as any;
    const { getDisconnectHandler, socket } = setupHarness(room);
    socket.data.currentRoomCode = 'ROOM';
    socket.data.currentPlayerId = 'P1';

    try {
      getDisconnectHandler()();
      expect(room.setPlayerConnected).toHaveBeenCalledWith('P1', false);
      expect(systemMessageMock).toHaveBeenCalledWith(
        'ROOM',
        expect.stringContaining('disconnected'),
      );
      vi.runAllTimers();
      expect(engine.forfeitPlayer).toHaveBeenCalledWith('P1');
      expect(room.removePlayer).toHaveBeenCalledWith('P1');
      expect(emitPlayers).toHaveBeenCalledTimes(2);
      const lastSystem = systemMessageMock.mock.calls.at(-1);
      expect(lastSystem?.[1]).toMatch(/eliminated/);
    } finally {
      (getGameEngine as MockFn<[string], unknown>).mockReset();
      vi.useRealTimers();
    }
  });

  it('disconnect handler falls back to generic player name when lookup fails', () => {
    const room = createMockRoom({ code: 'ROOM' });
    room.hasPlayer.mockReturnValue(true);
    room.getPlayer.mockReturnValue(undefined);
    const { getDisconnectHandler, socket } = setupHarness(room);
    socket.data.currentRoomCode = 'ROOM';
    socket.data.currentPlayerId = 'P1';

    getDisconnectHandler()();

    expect(systemMessageMock).toHaveBeenCalledWith(
      'ROOM',
      'A player disconnected (will be removed if not back soon).',
    );
  });

  it('submitWord reports missing engine errors back to the client', () => {
    const room = createMockRoom({
      code: 'ROOM',
      players: [{ id: 'P1', name: 'Alpha', isSeated: true, isConnected: true }],
    });
    room.hasPlayer.mockReturnValue(true);
    room.game = {
      getCurrentPlayer: () => ({ id: 'P1' }),
    } as unknown as MockRoom['game'];
    (getGameEngine as MockFn<[string], unknown>).mockReturnValue(undefined);
    const { socket, getSubmitHandler } = setupHarness(room);
    const callback = vi.fn();

    getSubmitHandler()(
      {
        roomCode: 'ROOM',
        playerId: 'P1',
        word: 'alpha',
        clientActionId: 'missing-engine',
      },
      callback,
    );

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'Game engine not running.',
    });
    const ack = socket.emitted.find((evt) => evt.event === 'actionAck');
    expect(ack?.payload).toEqual({
      clientActionId: 'missing-engine',
      success: false,
      error: 'Game engine not running.',
    });
  });

  it('submitWord ignores non-string clientActionIds when emitting acknowledgements', () => {
    const room = createMockRoom({
      code: 'ROOM',
      players: [{ id: 'P1', name: 'Alpha', isSeated: true, isConnected: true }],
    });
    room.hasPlayer.mockReturnValue(true);
    const { socket, getSubmitHandler } = setupHarness(room);
    const callback = vi.fn();

    getSubmitHandler()(
      {
        roomCode: 'ROOM',
        playerId: 'P1',
        word: 'alpha',
        clientActionId: 123,
      } as any,
      callback,
    );

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'Game not running.',
    });
    const ack = socket.emitted.find((evt) => evt.event === 'actionAck');
    expect(ack).toBeUndefined();
  });

  it('updateRoomRules rejects invalid payloads', () => {
    const { getUpdateRulesHandler } = setupHarness();
    const callback = vi.fn();

    getUpdateRulesHandler()('invalid', callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid payload',
    });
  });

  it('updateRoomRules requires string room codes in payload', () => {
    const { getUpdateRulesHandler } = setupHarness();
    const callback = vi.fn();

    getUpdateRulesHandler()({ roomCode: 123, rules: {} } as any, callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid payload',
    });
  });

  it('updateRoomRules returns error when room is missing', () => {
    const { getUpdateRulesHandler, socket } = setupHarness();
    socket.data.currentPlayerId = 'leader';
    const callback = vi.fn();

    getUpdateRulesHandler()({ roomCode: 'ROOM', rules: {} }, callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'Room not found',
    });
  });

  it('updateRoomRules requires a recognized player id', () => {
    const room = createMockRoom({ code: 'ROOM' });
    const { getUpdateRulesHandler } = setupHarness(room);
    const callback = vi.fn();

    getUpdateRulesHandler()({ roomCode: 'ROOM', rules: room.rules }, callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'Player not recognized',
    });
  });

  it('updateRoomRules propagates validation failures', () => {
    const room = createMockRoom({ code: 'ROOM', leaderId: 'leader' });
    const { getUpdateRulesHandler, socket } = setupHarness(room);
    socket.data.currentRoomCode = 'ROOM';
    socket.data.currentPlayerId = 'leader';
    const callback = vi.fn();

    getUpdateRulesHandler()(
      { roomCode: 'ROOM', rules: { invalid: true } },
      callback,
    );

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: expect.stringContaining('Invalid'),
    });
  });

  it('updateRoomRules falls back to generic error when schema issues absent', async () => {
    const room = createMockRoom({ code: 'ROOM', leaderId: 'leader' });
    const { getUpdateRulesHandler, socket } = setupHarness(room);
    socket.data.currentRoomCode = 'ROOM';
    socket.data.currentPlayerId = 'leader';
    const callback = vi.fn();

    const schemaModule = await import('@game/domain/rooms/GameRoomRules');
    const spy = vi
      .spyOn(schemaModule.GameRulesSchema, 'safeParse')
      .mockReturnValueOnce({ success: false, error: { issues: [] } } as any);

    getUpdateRulesHandler()({ roomCode: 'ROOM', rules: {} }, callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid rules provided',
    });
    spy.mockRestore();
  });

  it('updateRoomRules surfaces errors thrown while updating rules', () => {
    const room = createMockRoom({ code: 'ROOM', leaderId: 'leader' });
    room.updateRules.mockImplementation(() => {
      throw new Error('update failed');
    });
    const { getUpdateRulesHandler, socket } = setupHarness(room);
    socket.data.currentRoomCode = 'ROOM';
    socket.data.currentPlayerId = 'leader';
    const callback = vi.fn();

    getUpdateRulesHandler()({ roomCode: 'ROOM', rules: room.rules }, callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'update failed',
    });
  });
});
