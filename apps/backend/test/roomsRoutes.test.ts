/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';

// Hoist mock for roomManager before importing the router
vi.mock('../src/room/roomManagerSingleton', () => ({
  roomManager: {
    create: vi.fn(),
    has: vi.fn(),
  },
}));

// Import after mocks so router uses mocked roomManager
import roomsRouter from '../src/routes/rooms';
import { roomManager } from '../src/room/roomManagerSingleton';

function startTestServer(): Promise<{
  port: number;
  close: () => Promise<void>;
}> {
  return new Promise((resolve) => {
    const app = express();
    app.use(express.json());
    app.use('/', roomsRouter);
    const server: Server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({
        port,
        close: () =>
          new Promise<void>((r) => {
            server.close(() => {
              r();
            });
          }),
      });
    });
  });
}

describe('rooms routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (roomManager.create as unknown as ReturnType<typeof vi.fn>).mockReset();
    (roomManager.has as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('POST / creates a room and returns code', async () => {
    // createMock should succeed (no throw)
    (
      roomManager.create as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(() => ({}));
    const { port, close } = await startTestServer();
    try {
      const res = await fetch(`http://127.0.0.1:${port.toString()}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as { code: string };
      expect(typeof body.code).toBe('string');
      expect(body.code).toMatch(/^[A-Z]{4}$/); // 4 uppercase letters
      const createMock = roomManager.create as unknown as ReturnType<
        typeof vi.fn
      >;
      expect(createMock).toHaveBeenCalledTimes(1);
      // First arg to create is the code we returned
      // Cast to any to access mock internals
      const firstCall = (
        roomManager.create as unknown as ReturnType<typeof vi.fn>
      ).mock.calls[0];
      expect(firstCall[0]).toBe(body.code);
      // Second argument are default rules
      expect(firstCall[1]).toMatchObject({
        maxLives: 3,
        startingLives: 3,
        minTurnDuration: 5,
        minWordsPerPrompt: 500,
      });
    } finally {
      await close();
    }
  });

  it('GET /:code returns 200 when room exists', async () => {
    (roomManager.has as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      true,
    );
    const { port, close } = await startTestServer();
    try {
      const res = await fetch(`http://127.0.0.1:${port.toString()}/ABCD`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { exists: boolean };
      expect(body).toEqual({ exists: true });
      const hasMock = roomManager.has as unknown as ReturnType<typeof vi.fn>;
      expect(hasMock).toHaveBeenCalledWith('ABCD');
    } finally {
      await close();
    }
  });

  it('GET /:code returns 404 when room missing', async () => {
    (roomManager.has as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      false,
    );
    const { port, close } = await startTestServer();
    try {
      const res = await fetch(`http://127.0.0.1:${port.toString()}/WXYZ`);
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('Room not found');
      const hasMock = roomManager.has as unknown as ReturnType<typeof vi.fn>;
      expect(hasMock).toHaveBeenCalledWith('WXYZ');
    } finally {
      await close();
    }
  });

  it('POST / returns 400 when create throws', async () => {
    (
      roomManager.create as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(() => {
      throw new Error('Room already exists');
    });
    const { port, close } = await startTestServer();
    try {
      const res = await fetch(`http://127.0.0.1:${port.toString()}/`, {
        method: 'POST',
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('Room already exists');
      const createMock = roomManager.create as unknown as ReturnType<
        typeof vi.fn
      >;
      expect(createMock).toHaveBeenCalledTimes(1);
    } finally {
      await close();
    }
  });
});
