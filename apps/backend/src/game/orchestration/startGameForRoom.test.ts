import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { roomManager } from '../../room/roomManagerSingleton';
import { startGameForRoom } from './startGameForRoom';
import { createServer } from 'http';
import { createTypedServer, type TypedServer } from '../../socket/typedSocket';
import { GameRoomRules } from '@game/domain/rooms/GameRoomRules';
import { getGameEngine } from '../engineRegistry';
import * as createGameEngineModule from './createGameEngine';
import * as dictionaryModule from '../../dictionary';
import type { DictionaryPort } from '../../dictionary';

// Minimal fake IO capturing emissions
function makeIO(): {
  io: TypedServer;
  httpServer: ReturnType<typeof createServer>;
} {
  const httpServer = createServer();
  const io = createTypedServer(httpServer);
  return { io, httpServer };
}

const rules: GameRoomRules = {
  maxLives: 3,
  startingLives: 3,
  bonusTemplate: new Array(26).fill(1),
  minTurnDuration: 5,
  minWordsPerPrompt: 1,
};

function createSeatedRoom(code: string, seatedCount: number) {
  const room = roomManager.create(code, rules);
  const ids = ['P1', 'P2', 'P3', 'P4'];
  for (let i = 0; i < seatedCount; i++) {
    const id = ids[i];
    room.addPlayer({ id, name: id });
    room.setPlayerSeated(id, true);
  }
  return room;
}

describe('startGameForRoom', () => {
  let io: TypedServer;
  let httpServer: ReturnType<typeof createServer>;
  let createDictionaryPortSpy: ReturnType<typeof vi.spyOn>;
  let dictionary: DictionaryPort;

  beforeEach(() => {
    roomManager.clear();
    ({ io, httpServer } = makeIO());
    dictionary = {
      isValid: vi.fn(() => true),
      getRandomFragment: vi.fn(() => 'aa'),
    };
    createDictionaryPortSpy = vi
      .spyOn(dictionaryModule, 'createDictionaryPort')
      .mockReturnValue(dictionary);
  });

  afterEach(() => {
    void io.close();
    httpServer.close();
    createDictionaryPortSpy.mockRestore();
  });

  it('returns early if game already exists', () => {
    const room = createSeatedRoom('ALRD', 2);
    // first start
    startGameForRoom(io, room);
    const firstGame = room.game;
    expect(firstGame).toBeTruthy();
    // second start should not replace game or create another engine
    const engineSpy = vi.spyOn(createGameEngineModule, 'createGameEngine');
    startGameForRoom(io, room);
    expect(room.game).toBe(firstGame);
    expect(engineSpy).not.toHaveBeenCalled();
    engineSpy.mockRestore();
  });

  it('does nothing if not enough seated players', () => {
    const room = createSeatedRoom('SMAL', 1);
    startGameForRoom(io, room);
    expect(room.game).toBeUndefined();
  });

  it('creates engine and begins game when valid', () => {
    const room = createSeatedRoom('GOOD', 3);
    const beginSpy = vi.spyOn(createGameEngineModule, 'createGameEngine');
    startGameForRoom(io, room);
    expect(room.game).toBeTruthy();
    const engine = getGameEngine('GOOD');
    expect(engine).toBeTruthy();
    // engine.beginGame() indirectly emits turnStarted; ensure fragment present
    expect(room.game?.fragment).toBeTruthy();
    expect(createDictionaryPortSpy).toHaveBeenCalledTimes(1);
    expect(beginSpy).toHaveBeenCalledWith(
      io,
      room,
      expect.anything(),
      dictionary,
    );
    beginSpy.mockRestore();
  });

  it('uses provided dictionary when supplied via options', () => {
    const room = createSeatedRoom('INJD', 2);
    const customDictionary: DictionaryPort = {
      isValid: vi.fn(() => true),
      getRandomFragment: vi.fn(() => 'zz'),
    };
    const beginSpy = vi.spyOn(createGameEngineModule, 'createGameEngine');
    createDictionaryPortSpy.mockClear();

    startGameForRoom(io, room, { dictionary: customDictionary });

    expect(createDictionaryPortSpy).not.toHaveBeenCalled();
    expect(room.game?.fragment).toBe('zz');
    expect(beginSpy).toHaveBeenCalledWith(
      io,
      room,
      expect.anything(),
      customDictionary,
    );
    beginSpy.mockRestore();
  });
});
