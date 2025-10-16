import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Game } from '@game/domain/game/Game';
import { GameRoomRules } from '@game/domain/rooms/GameRoomRules';
import { GameRulesService } from '@game/domain/game/services/GameRulesService';
import { createPlayer } from '@game/domain/players/createPlayer';
import { GameEngine } from './GameEngine';
import type { DictionaryPort } from '../../../platform/dictionary';
import { buildTurnStartedPayload } from '../../../platform/socket/serialization';

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
      emit: <
        K extends keyof import('@word-bomb/types/socket').ServerToClientEvents,
      >(
        event: K,
        ...args: Parameters<
          import('@word-bomb/types/socket').ServerToClientEvents[K]
        >
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

  it('forfeitPlayer eliminates current player and continues with next turn', () => {
    const players = [
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
      createPlayer({
        id: 'C',
        name: 'Cleo',
        isLeader: false,
        lives: 3,
        bonusTemplate: rules.bonusTemplate,
      }),
    ];
    const game = new Game({
      roomCode: 'ABCD',
      players,
      currentTurnIndex: 0,
      fragment: 'ar',
      state: 'active',
      rules,
    });
    const emitted: { e: string; payload: unknown }[] = [];
    const engine = new GameEngine({
      game,
      emit: <
        K extends keyof import('@word-bomb/types/socket').ServerToClientEvents,
      >(
        event: K,
        ...args: Parameters<
          import('@word-bomb/types/socket').ServerToClientEvents[K]
        >
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
    emitted.length = 0; // reset to observe forfeit emissions only

    engine.forfeitPlayer('A');

    expect(players[0].isEliminated).toBe(true);
    expect(players[0].lives).toBe(0);

    const updateEvent = emitted.find((ev) => ev.e === 'playerUpdated');
    expect(updateEvent).toBeDefined();

    const nextTurn = emitted.findLast?.((ev) => ev.e === 'turnStarted');
    const payload = (nextTurn ?? emitted.find((ev) => ev.e === 'turnStarted'))
      ?.payload as ReturnType<typeof buildTurnStartedPayload> | undefined;
    expect(payload?.playerId).toBe('B');
  });

  it('forfeitPlayer tolerates errors retrieving the current player', () => {
    const game = makeGame();
    const engine = new GameEngine({
      game,
      emit: () => {
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
    const advanceSpy = vi
      .spyOn(engine as unknown as { advanceTurn: () => void }, 'advanceTurn')
      .mockImplementation(() => {
        /* noop */
      });
    const gameOverSpy = vi
      .spyOn(
        engine as unknown as { handleGameOverIfAny: () => boolean },
        'handleGameOverIfAny',
      )
      .mockReturnValue(false);
    const getCurrentSpy = vi
      .spyOn(GameRulesService.prototype, 'getCurrentPlayer')
      .mockImplementationOnce(() => {
        throw new Error('unavailable');
      });

    engine.forfeitPlayer('B');

    expect(advanceSpy).toHaveBeenCalled();

    advanceSpy.mockRestore();
    gameOverSpy.mockRestore();
    getCurrentSpy.mockRestore();
  });

  it('forfeitPlayer aligns current turn index to existing player when forfeiting others', () => {
    const players = [
      createPlayer({
        id: 'A',
        name: 'Alpha',
        isLeader: true,
        lives: 3,
        bonusTemplate: rules.bonusTemplate,
      }),
      createPlayer({
        id: 'B',
        name: 'Beta',
        isLeader: false,
        lives: 3,
        bonusTemplate: rules.bonusTemplate,
      }),
      createPlayer({
        id: 'C',
        name: 'Gamma',
        isLeader: false,
        lives: 3,
        bonusTemplate: rules.bonusTemplate,
      }),
    ];
    const game = new Game({
      roomCode: 'ROOM',
      players,
      currentTurnIndex: 0,
      fragment: 'ga',
      state: 'active',
      rules,
    });
    const engine = new GameEngine({
      game,
      emit: () => {
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
    const advanceSpy = vi
      .spyOn(engine as unknown as { advanceTurn: () => void }, 'advanceTurn')
      .mockImplementation(() => {
        /* noop */
      });
    const currentSpy = vi
      .spyOn(GameRulesService.prototype, 'getCurrentPlayer')
      .mockImplementation(() => players[2]);

    engine.forfeitPlayer('B');

    expect(game.currentTurnIndex).toBe(
      game.getActivePlayers().findIndex((p) => p.id === 'C'),
    );
    expect(advanceSpy).not.toHaveBeenCalled();

    advanceSpy.mockRestore();
    currentSpy.mockRestore();
  });

  it('forfeitPlayer ignores unknown and already eliminated players', () => {
    const game = makeGame();
    const engine = new GameEngine({
      game,
      emit: () => {
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
    const advanceSpy = vi
      .spyOn(engine as unknown as { advanceTurn: () => void }, 'advanceTurn')
      .mockImplementation(() => {
        /* noop */
      });

    engine.forfeitPlayer('missing');
    const player = game.players[0];
    player.eliminate();
    engine.forfeitPlayer(player.id);

    expect(advanceSpy).not.toHaveBeenCalled();

    advanceSpy.mockRestore();
  });
});
