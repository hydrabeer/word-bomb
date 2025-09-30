import type { Request, Response } from 'express';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Hoist mock for roomManager before importing the router handlers
vi.mock('../src/room/roomManagerSingleton', () => ({
  roomManager: {
    create: vi.fn(),
    has: vi.fn(),
    get: vi.fn(),
  },
}));

const { roomCodeGeneratorMock, createRoomCodeGeneratorMock } = vi.hoisted(
  () => {
    const generator = vi.fn(() => 'AAAA');
    return {
      roomCodeGeneratorMock: generator,
      createRoomCodeGeneratorMock: vi.fn(() => generator),
    };
  },
);

vi.mock('../src/routes/roomCodeGenerator', () => ({
  createRoomCodeGenerator: createRoomCodeGeneratorMock,
}));

vi.mock('../src/dictionary', () => ({
  getDictionaryStats: vi.fn(() => ({ wordCount: 1000, fragmentCount: 100 })),
  isUsingFallbackDictionary: vi.fn(() => false),
}));

import { roomManager } from '../src/room/roomManagerSingleton';
import {
  createRoomHandler,
  getRoomHandler,
  resetRoomCodeGenerator,
  setRoomCodeGenerator,
} from '../src/routes/rooms';
import {
  getDictionaryStats,
  isUsingFallbackDictionary,
} from '../src/dictionary';

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
    vi.clearAllMocks();
    (roomManager.create as ReturnType<typeof vi.fn>).mockReset();
    (roomManager.has as ReturnType<typeof vi.fn>).mockReset();
    (roomManager.get as ReturnType<typeof vi.fn>).mockReset();
    roomCodeGeneratorMock.mockReset();
    roomCodeGeneratorMock.mockReturnValue('AAAA');
    createRoomCodeGeneratorMock.mockReset();
    createRoomCodeGeneratorMock.mockReturnValue(roomCodeGeneratorMock);
    (getDictionaryStats as ReturnType<typeof vi.fn>).mockReturnValue({
      wordCount: 1000,
      fragmentCount: 100,
    });
    (isUsingFallbackDictionary as ReturnType<typeof vi.fn>).mockReturnValue(
      false,
    );
    resetRoomCodeGenerator();
  });

  it('createRoomHandler creates a room and returns a deterministic code', () => {
    (roomManager.create as ReturnType<typeof vi.fn>).mockImplementation(
      () => ({}),
    );
    setRoomCodeGenerator(() => 'AAAA');
    const { response, statusMock, jsonMock } = createMockResponse<{
      code: string;
    }>();

    const request = {
      body: { name: '  Trivia night  ' },
    } as unknown as Request;
    createRoomHandler(request, response as unknown as Response);

    expect(statusMock).toHaveBeenCalledWith(201);
    expect(jsonMock).toHaveBeenCalledWith({ code: 'AAAA' });
    expect(getDictionaryStats).toHaveBeenCalled();
    expect(isUsingFallbackDictionary).toHaveBeenCalled();

    // eslint-disable-next-line @typescript-eslint/unbound-method
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
  });

  it('createRoomHandler returns 400 when roomManager.create throws non-duplicate error', () => {
    (roomManager.create as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Unexpected failure');
    });
    const { response, statusMock, jsonMock } = createMockResponse<{
      error: string;
    }>();
    const request = { body: {} } as unknown as Request;

    createRoomHandler(request, response as unknown as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Unexpected failure' });
  });

  it('createRoomHandler returns 503 when unique code cannot be allocated', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const createMock = roomManager.create as ReturnType<typeof vi.fn>;
    createMock.mockImplementation(() => {
      throw new Error('Room DUPL already exists');
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const hasMock = roomManager.has as ReturnType<typeof vi.fn>;
    hasMock.mockReturnValue(false);
    setRoomCodeGenerator(() => 'AAAA');
    const { response, statusMock, jsonMock } = createMockResponse<{
      error: string;
    }>();

    const request = { body: {} } as unknown as Request;

    createRoomHandler(request, response as unknown as Response);

    expect(statusMock).toHaveBeenCalledWith(503);
    expect(jsonMock).toHaveBeenCalledWith({
      error: expect.stringContaining('Unable to allocate unique room code'),
    });
    expect(createMock).toHaveBeenCalledTimes(100);
  });

  it('createRoomHandler retries when generated code already exists', () => {
    const createMock = roomManager.create as ReturnType<typeof vi.fn>;
    createMock.mockImplementation(() => ({}));
    const hasMock = roomManager.has as ReturnType<typeof vi.fn>;
    hasMock
      .mockImplementationOnce(() => true)
      .mockImplementationOnce(() => false);
    roomCodeGeneratorMock
      .mockImplementationOnce(() => 'AAAA')
      .mockImplementationOnce(() => 'BBBB');

    const { response } = createMockResponse<{ code: string }>();
    setRoomCodeGenerator(roomCodeGeneratorMock);

    createRoomHandler(
      { body: {} } as unknown as Request,
      response as unknown as Response,
    );

    expect(hasMock).toHaveBeenCalledTimes(2);
    expect(createMock).toHaveBeenCalledWith('BBBB', expect.any(Object), '');
  });

  it('createRoomHandler handles missing request body gracefully', () => {
    (roomManager.create as ReturnType<typeof vi.fn>).mockImplementation(
      () => ({}),
    );
    roomCodeGeneratorMock.mockReturnValue('ZZZZ');
    setRoomCodeGenerator(roomCodeGeneratorMock);
    const { response } = createMockResponse<{ code: string }>();

    createRoomHandler(
      {} as unknown as Request,
      response as unknown as Response,
    );

    const [, , providedName] = (roomManager.create as ReturnType<typeof vi.fn>)
      .mock.calls[0] as [string, Record<string, unknown>, string];
    expect(providedName).toBe('');
  });

  it('createRoomHandler lowers minWordsPerPrompt when dictionary fallback is active', () => {
    (roomManager.create as ReturnType<typeof vi.fn>).mockImplementation(
      () => ({}),
    );
    (isUsingFallbackDictionary as ReturnType<typeof vi.fn>).mockReturnValue(
      true,
    );
    (getDictionaryStats as ReturnType<typeof vi.fn>).mockReturnValue({
      wordCount: 20,
      fragmentCount: 10,
    });

    const { response } = createMockResponse<{ code: string }>();
    createRoomHandler(
      { body: {} } as unknown as Request,
      response as unknown as Response,
    );

    const [, rules] = (roomManager.create as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, Record<string, unknown>, string];

    expect(rules).toMatchObject({ minWordsPerPrompt: 1 });
  });

  it('getRoomHandler returns 200 when room exists', () => {
    (roomManager.get as ReturnType<typeof vi.fn>).mockReturnValue({
      name: '  Trivia night  ',
    });
    const { response, statusMock, jsonMock } = createMockResponse<{
      exists: boolean;
      name: string;
    }>();
    const request = { params: { code: 'ABCD' } } as unknown as Request;

    getRoomHandler(request, response as unknown as Response);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(roomManager.get).toHaveBeenCalledWith('ABCD');
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      exists: true,
      name: 'Trivia night',
    });
  });

  it('getRoomHandler normalizes non-string room names', () => {
    (roomManager.get as ReturnType<typeof vi.fn>).mockReturnValue({ name: 42 });
    const { response, jsonMock } = createMockResponse<{
      exists: boolean;
      name: string;
    }>();

    getRoomHandler(
      { params: { code: 'ROOM' } } as unknown as Request,
      response as unknown as Response,
    );

    expect(jsonMock).toHaveBeenCalledWith({ exists: true, name: '' });
  });

  it('getRoomHandler returns 404 when room is missing', () => {
    (roomManager.get as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const { response, statusMock, jsonMock } = createMockResponse<{
      error: string;
    }>();
    const request = { params: { code: 'WXYZ' } } as unknown as Request;

    getRoomHandler(request, response as unknown as Response);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(roomManager.get).toHaveBeenCalledWith('WXYZ');
    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Room not found' });
  });
});
