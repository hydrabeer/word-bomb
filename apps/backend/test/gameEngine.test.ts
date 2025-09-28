import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Game, GameRoomRules, createPlayer } from '@game/domain';
import { GameEngine } from '../src/game/GameEngine';
import type { DictionaryPort } from '../src/dictionary';
import { buildTurnStartedPayload } from '../src/core/serialization';

const rules: GameRoomRules = {
  maxLives: 3,
  startingLives: 3,
  bonusTemplate: new Array(26).fill(1),
  minTurnDuration: 5,
  minWordsPerPrompt: 2,
};

function stubDictionary(): DictionaryPort {
  return {
    isValid: () => true,
    getRandomFragment: () => 'aa',
  };
}

function makePlayers() {
  return [
    createPlayer({
      id: 'A',
      name: 'Alice',
      isLeader: true,
      lives: 3,
      bonusTemplate: rules.bonusTemplate,
    }),
    createPlayer({
      id: 'B',
      name: 'Bob',
      isLeader: false,
      lives: 3,
      bonusTemplate: rules.bonusTemplate,
    }),
  ];
}

function makeGame() {
  const players = makePlayers();
  return new Game({
    roomCode: 'ABCD',
    players,
    currentTurnIndex: 0,
    fragment: 'ar',
    state: 'active',
    rules,
  });
}

describe('GameEngine extra coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('emits turnStarted and handles turn timeout life loss', () => {
    const game = makeGame();
    // Force consistent bomb duration
    game.__setBombDurationForTest(1);
    interface Emitted {
      e: string;
      payload: unknown;
    }
    const emitted: Emitted[] = [];
    const engine = new GameEngine({
      game,
      emit: <K extends keyof import('@word-bomb/types').ServerToClientEvents>(
        event: K,
        ...args: Parameters<import('@word-bomb/types').ServerToClientEvents[K]>
      ) => {
        emitted.push({ e: String(event), payload: args[0] });
      },
      scheduler: {
        schedule: (delayMs, cb) => setTimeout(cb, delayMs),
        cancel: (token) => {
          clearTimeout(token as any);
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
      dictionary: stubDictionary(),
    });
    engine.beginGame();
    expect(emitted.find((ev) => ev.e === 'turnStarted')?.payload).toEqual(
      buildTurnStartedPayload(game),
    );
    vi.advanceTimersByTime(1100);
    // after timeout playerUpdated should be emitted
    expect(emitted.some((ev) => ev.e === 'playerUpdated')).toBe(true);
  });

  it('validateSubmission paths return errors', () => {
    const game = makeGame();
    const engine = new GameEngine({
      game,
      emit: function emit() {
        /* noop */
      },
      scheduler: {
        schedule: (delayMs, cb) => setTimeout(cb, delayMs),
        cancel: (token) => {
          clearTimeout(token as any);
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
      dictionary: stubDictionary(),
    });
    expect(engine.submitWord('B', 'word').success).toBe(false); // not your turn
    expect(engine.submitWord('A', 'a').success).toBe(false); // too short
    expect(engine.submitWord('A', 'zzzz').success).toBe(false); // no fragment
  });

  it('game over triggers onGameEnded when one player eliminated', () => {
    const game = makeGame();
    // eliminate one manually then set second low lives to force loss on timeout
    const a = game.players[0];
    a.loseLife();
    a.loseLife();
    a.loseLife(); // 0 lives -> eliminated
    const onGameEnded = vi.fn();
    game.__setBombDurationForTest(1);
    const engine = new GameEngine({
      game,
      emit: function emit() {
        /* noop */
      },
      scheduler: {
        schedule: (delayMs, cb) => setTimeout(cb, delayMs),
        cancel: (token) => {
          clearTimeout(token as any);
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
        gameEnded: onGameEnded,
      },
      dictionary: stubDictionary(),
    });
    engine.beginGame();
    vi.advanceTimersByTime(1100);
    expect(onGameEnded).toHaveBeenCalled();
  });

  it('invokes onTurnTimeout callback when provided', () => {
    const game = makeGame();
    game.__setBombDurationForTest(1);
    const onTurnTimeout = vi.fn();
    const engine = new GameEngine({
      game,
      emit: function emit() {
        /* noop */
      },
      scheduler: {
        schedule: (delayMs, cb) => setTimeout(cb, delayMs),
        cancel: (token) => {
          clearTimeout(token as any);
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
      onTurnTimeout,
      dictionary: stubDictionary(),
    });

    engine.beginGame();
    vi.advanceTimersByTime(1100);

    expect(onTurnTimeout).toHaveBeenCalledTimes(1);
    expect(onTurnTimeout.mock.calls[0][0].id).toBe('A');
  });
});
