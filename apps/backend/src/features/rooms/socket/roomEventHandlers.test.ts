import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRoomEventHandlers } from './roomEventHandlers';
import { roomManager } from '../app/roomManagerSingleton';
import type { RoomHandlerContext } from './roomHandlerContext';
import type { SocketSession } from '../../../platform/socket/socketSession';
import { emitPlayers } from '../../gameplay/app/emitPlayers';

vi.mock('../../game/orchestration/emitPlayers', () => ({
  emitPlayers: vi.fn(),
}));

describe('roomEventHandlers.disconnect', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns early when the player is no longer tracked by the room', () => {
    const roomCode = 'ABCD';
    const playerId = 'player-123';
    const session = {
      getRoomCode: vi.fn().mockReturnValue(roomCode),
      getPlayerId: vi.fn().mockReturnValue(playerId),
    } as unknown as SocketSession;

    const hasPlayer = vi.fn().mockReturnValue(false);
    const mockRoom = { hasPlayer } as { hasPlayer: (id: string) => boolean };
    const getSpy = vi
      .spyOn(roomManager, 'get')
      .mockReturnValue(mockRoom as never);

    const system = vi.fn();
    const cleanupRoomIfEmpty = vi.fn();
    const context: RoomHandlerContext = {
      io: {} as never,
      socket: { id: 'socket-1' } as never,
      session,
      broadcaster: {} as never,
      system,
      cleanupRoomIfEmpty,
    };

    const handlers = createRoomEventHandlers(context);
    handlers.disconnect();

    const mockedEmitPlayers = vi.mocked(emitPlayers);
    expect(session.getRoomCode).toHaveBeenCalledTimes(1);
    expect(session.getPlayerId).toHaveBeenCalledTimes(1);
    expect(hasPlayer).toHaveBeenCalledWith(playerId);
    expect(system).not.toHaveBeenCalled();
    expect(mockedEmitPlayers).not.toHaveBeenCalled();
    expect(cleanupRoomIfEmpty).not.toHaveBeenCalled();

    getSpy.mockRestore();
  });
});
