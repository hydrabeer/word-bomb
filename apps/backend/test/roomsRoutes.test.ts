import type { Request, Response } from 'express';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Hoist mock for roomManager before importing the router handlers
vi.mock('../src/room/roomManagerSingleton', () => ({
  roomManager: {
    create: vi.fn(),
    has: vi.fn(),
  },
}));

import { roomManager } from '../src/room/roomManagerSingleton';
import { createRoomHandler, getRoomHandler } from '../src/routes/rooms';

interface MockResponse<TPayload> {
  statusCode?: number;
  payload?: TPayload;
  status: (code: number) => MockResponse<TPayload>;
  json: (body: TPayload) => MockResponse<TPayload>;
}

function createMockResponse<TPayload>(): {
  response: MockResponse<TPayload>;
  statusMock: ReturnType<typeof vi.fn>;
  jsonMock: ReturnType<typeof vi.fn>;
} {
  const response: MockResponse<TPayload> = {
    statusCode: undefined,
    payload: undefined,
    status: ((code: number) => {
      response.statusCode = code;
      return response;
    }) as (code: number) => MockResponse<TPayload>,
    json: ((body: TPayload) => {
      response.payload = body;
      return response;
    }) as (body: TPayload) => MockResponse<TPayload>,
  };

  const statusMock = vi.fn(response.status);
  const jsonMock = vi.fn(response.json);

  response.status = statusMock as unknown as MockResponse<TPayload>['status'];
  response.json = jsonMock as unknown as MockResponse<TPayload>['json'];

  return { response, statusMock, jsonMock };
}

describe('rooms router handlers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (roomManager.create as ReturnType<typeof vi.fn>).mockReset();
    (roomManager.has as ReturnType<typeof vi.fn>).mockReset();
  });

  it('createRoomHandler creates a room and returns a deterministic code', () => {
    (roomManager.create as ReturnType<typeof vi.fn>).mockImplementation(
      () => ({}),
    );
    const mathRandomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const { response, statusMock, jsonMock } = createMockResponse<{
      code: string;
    }>();

    const request = {
      body: { name: '  Trivia night  ' },
    } as unknown as Request;
    try {
      createRoomHandler(request, response as unknown as Response);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({ code: 'AAAA' });

      const createMock = roomManager.create as ReturnType<typeof vi.fn>;
      expect(createMock).toHaveBeenCalledTimes(1);
      const [code, rules, trimmedName] = createMock.mock.calls[0] as [
        string,
        Record<string, unknown>,
        string,
      ];
      expect(code).toBe('AAAA');
      expect(rules).toMatchObject({
        maxLives: 3,
        startingLives: 3,
        minTurnDuration: 5,
        minWordsPerPrompt: 500,
      });
      expect(trimmedName).toBe('Trivia night');
    } finally {
      mathRandomSpy.mockRestore();
    }
  });

  it('createRoomHandler returns 400 when roomManager.create throws', () => {
    (roomManager.create as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Room already exists');
    });
    const { response, statusMock, jsonMock } = createMockResponse<{
      error: string;
    }>();
    const request = { body: {} } as unknown as Request;

    createRoomHandler(request, response as unknown as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Room already exists' });
  });

  it('getRoomHandler returns 200 when room exists', () => {
    (roomManager.has as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const { response, statusMock, jsonMock } = createMockResponse<{
      exists: boolean;
    }>();
    const request = { params: { code: 'ABCD' } } as unknown as Request;

    getRoomHandler(request, response as unknown as Response);

    expect(roomManager.has).toHaveBeenCalledWith('ABCD');
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ exists: true });
  });

  it('getRoomHandler returns 404 when room is missing', () => {
    (roomManager.has as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const { response, statusMock, jsonMock } = createMockResponse<{
      error: string;
    }>();
    const request = { params: { code: 'WXYZ' } } as unknown as Request;

    getRoomHandler(request, response as unknown as Response);

    expect(roomManager.has).toHaveBeenCalledWith('WXYZ');
    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Room not found' });
  });
});
