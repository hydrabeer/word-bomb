import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { roomManager } from '../src/room/roomManagerSingleton';
import { startGameForRoom } from '../src/game/orchestration/startGameForRoom';
import { createServer } from 'http';
import { Server } from 'socket.io';
import type { TypedServer } from '../src/socket/typedSocket';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@word-bomb/types';
import { GameRoomRules } from '@game/domain';
import { getGameEngine } from '../src/game/engineRegistry';
import * as createGameEngineModule from '../src/game/orchestration/createGameEngine';

// Minimal fake IO capturing emissions
function makeIO(): {
  io: TypedServer;
  httpServer: ReturnType<typeof createServer>;
} {
  const httpServer = createServer();
  const io: TypedServer = new Server<
    ClientToServerEvents,
    ServerToClientEvents
  >(httpServer, {});
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

  beforeEach(() => {
    roomManager.clear();
    ({ io, httpServer } = makeIO());
  });

  afterEach(() => {
    void io.close();
    httpServer.close();
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
    beginSpy.mockRestore();
  });
});
