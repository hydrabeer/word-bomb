import { GameRoomManager } from '../src/room/GameRoomManager';
import { Game } from '@game/domain/game/Game';
import { GameRoomRules } from '@game/domain/rooms/GameRoomRules';
import { GameEngine } from '../src/game/GameEngine';
import type { ServerToClientEvents } from '@word-bomb/types/socket';
import type { Player } from '@game/domain/players/Player';

export const defaultRules: GameRoomRules = {
  maxLives: 3,
  startingLives: 3,
  bonusTemplate: new Array(26).fill(1),
  minTurnDuration: 5,
  minWordsPerPrompt: 2,
};

export function makeRoom(code = 'TEST', rules: GameRoomRules = defaultRules) {
  const mgr = new GameRoomManager();
  const room = mgr.create(code, rules);
  return { mgr, room };
}

export function addPlayer(
  roomCode: string,
  mgr: GameRoomManager,
  id: string,
  name: string,
  seated = false,
) {
  const room = mgr.get(roomCode);
  if (!room) throw new Error('room missing');
  room.addPlayer({ id, name });
  if (seated) room.setPlayerSeated(id, true);
  const player = room.getPlayer(id);
  if (!player) throw new Error('player missing after add');
  return player;
}

export function makeGame(
  roomCode: string,
  players: Player[],
  rules: GameRoomRules = defaultRules,
) {
  return new Game({
    roomCode,
    players,
    currentTurnIndex: 0,
    fragment: 'ar',
    state: 'active',
    rules,
  });
}

export interface EmittedEvent<
  K extends keyof ServerToClientEvents = keyof ServerToClientEvents,
> {
  event: K;
  payload: Parameters<ServerToClientEvents[K]>[0];
}

export function makeEngine(game: Game): {
  engine: GameEngine;
  events: EmittedEvent[];
} {
  const raw: EmittedEvent[] = [];
  const engine = new GameEngine({
    game,
    emit: (event, ...args) => {
      raw.push({ event, payload: args[0] as never });
    },
    scheduler: {
      schedule: (delayMs, cb) => setTimeout(cb, delayMs),
      cancel: (token) => {
        clearTimeout(token as NodeJS.Timeout);
      },
    },
    eventsPort: {
      turnStarted: () => {
        /* noop */
      },
      playerUpdated: () => {
        /* noop */
      },
      wordAccepted: () => {
        /* noop */
      },
      gameEnded: () => {
        /* noop */
      },
    },
  });
  return { engine, events: raw };
}

export function withFakeTimers<T>(fn: () => T | Promise<T>) {
  return async () => {
    const vitest = await import('vitest');
    vitest.vi.useFakeTimers();
    try {
      return await fn();
    } finally {
      vitest.vi.useRealTimers();
    }
  };
}
