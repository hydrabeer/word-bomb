import { describe, expect, it } from 'vitest';
import type { TypedSocket } from './typedSocket';
import { SocketSession } from './socketSession';

function createStubSocket(): TypedSocket {
  return {
    data: {} as Record<string, unknown>,
  } as unknown as TypedSocket;
}

describe('SocketSession', () => {
  it('reset clears stored room and player identifiers', () => {
    const socket = createStubSocket();
    const session = new SocketSession(socket);

    session.setRoomCode('ROOM');
    session.setPlayerId('player-1');

    expect(session.getRoomCode()).toBe('ROOM');
    expect(session.getPlayerId()).toBe('player-1');

    session.reset();

    expect(session.getRoomCode()).toBeUndefined();
    expect(session.getPlayerId()).toBeUndefined();
    expect(socket.data).not.toHaveProperty('currentRoomCode');
    expect(socket.data).not.toHaveProperty('currentPlayerId');
  });
});
