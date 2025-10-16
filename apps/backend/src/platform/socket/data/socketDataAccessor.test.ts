import { describe, it, expect } from 'vitest';
import { createSocketDataAccessor } from './socketDataAccessor';
import type { TypedSocket } from '../typedSocket';

const isString = (value: unknown): value is string => typeof value === 'string';

function createMockSocket(): TypedSocket {
  return {
    data: {},
  } as unknown as TypedSocket;
}

describe('createSocketDataAccessor', () => {
  it('reads and writes string values', () => {
    const socket = createMockSocket();
    const accessor = createSocketDataAccessor(
      socket,
      'currentRoomCode',
      isString,
    );

    expect(accessor.get()).toBeUndefined();

    accessor.set('ROOM');
    expect(accessor.get()).toBe('ROOM');

    accessor.clear();
    expect(accessor.get()).toBeUndefined();
  });

  it('guards against invalid stored types', () => {
    const socket = createMockSocket();
    (socket as unknown as { data: unknown }).data = {
      currentRoomCode: 123,
    };
    const accessor = createSocketDataAccessor(
      socket,
      'currentRoomCode',
      isString,
    );

    expect(accessor.get()).toBeUndefined();
  });

  it('handles non-object socket.data gracefully', () => {
    const socket = createMockSocket();
    (socket as unknown as { data: unknown }).data = undefined;
    const accessor = createSocketDataAccessor(
      socket,
      'currentPlayerId',
      isString,
    );

    expect(accessor.get()).toBeUndefined();

    accessor.set('player-1');
    expect(accessor.get()).toBe('player-1');

    (socket as unknown as { data: unknown }).data = 42;
    accessor.clear();
    expect(accessor.get()).toBeUndefined();
  });
});
