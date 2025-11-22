import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Socket } from 'socket.io-client';

// Strongly typed io mock
const ioMock =
  vi.fn<
    (
      url: string,
      opts: { autoConnect: boolean; transports: string[] },
    ) => Socket
  >();
const socketInstance = {} as unknown as Socket;

vi.mock('socket.io-client', () => ({ io: ioMock }));

beforeEach(() => {
  ioMock.mockReset();
  ioMock.mockReturnValue(socketInstance);
});

afterEach(() => {
  vi.resetModules();
});

test('uses VITE_BACKEND_URL when provided', async () => {
  vi.stubEnv('VITE_BACKEND_URL', 'http://example.com:9999');

  const mod = await import('./socket');

  expect(ioMock).toHaveBeenCalledTimes(1);
  expect(ioMock).toHaveBeenCalledWith('http://example.com:9999', {
    autoConnect: false,
    transports: ['websocket'],
  });
  expect(mod.socket).toBe(socketInstance);
});

test('falls back to localhost when VITE_BACKEND_URL is empty/absent', async () => {
  vi.stubEnv('VITE_BACKEND_URL', '');

  const mod = await import('./socket');

  expect(ioMock).toHaveBeenCalledTimes(1);
  expect(ioMock).toHaveBeenCalledWith('http://localhost:3001', {
    autoConnect: false,
    transports: ['websocket'],
  });
  expect(mod.socket).toBe(socketInstance);
});
