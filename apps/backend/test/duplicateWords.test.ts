import { describe, it, expect, vi } from 'vitest';
import { Game, GameRoomRules, createPlayer } from '@game/domain';
import { GameEngine } from '../src/game/GameEngine';
import type { TurnScheduler, GameEventsPort } from '../src/game/GameEngine';
import type { DictionaryPort } from '../src/dictionary';
import type { ServerToClientEvents } from '@word-bomb/types';

const rules: GameRoomRules = {
  maxLives: 3,
  startingLives: 3,
  bonusTemplate: new Array(26).fill(1),
  minTurnDuration: 1,
  minWordsPerPrompt: 1,
};

function makeGame(fragment = 'aa') {
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
  ];
  return new Game({
    roomCode: 'DUPL',
    players,
    currentTurnIndex: 0,
    fragment,
    state: 'active',
    rules,
  });
}

describe('duplicate words are rejected within a game', () => {
  const dictionary: DictionaryPort = {
    isValid: () => true,
    getRandomFragment: () => 'aa',
  };

  it('rejects a word that has already been used and resets next game', () => {
    type EmitFn = <K extends keyof ServerToClientEvents>(
      event: K,
      ...args: Parameters<ServerToClientEvents[K]>
    ) => void;

    const emit: EmitFn = vi.fn();

    const scheduler: TurnScheduler = {
      schedule: vi.fn<(d: number, cb: () => void) => object | number>(
        (d, cb) => {
          const token = setTimeout(cb, d);
          return token as unknown as object;
        },
      ),
      cancel: vi.fn<(token: object | number) => void>((token) => {
        clearTimeout(token as unknown as NodeJS.Timeout);
      }),
    };

    const eventsPort: GameEventsPort = {
      turnStarted: vi.fn<(g: Game) => void>(),
      playerUpdated: vi.fn<(playerId: string, lives: number) => void>(),
      wordAccepted: vi.fn<(playerId: string, word: string) => void>(),
      gameEnded: vi.fn<(winnerId: string) => void>(),
    };

    const game = makeGame('aa');
    const engine = new GameEngine({
      game,
      emit,
      scheduler,
      eventsPort,
      dictionary,
    });

    const pA = game.getCurrentPlayer();
    // First submission passes
    const first = engine.submitWord(pA.id, 'aab');
    expect(first.success).toBe(true);

    // Turn advances to B, then back to A; try reuse
    const pB = game.getCurrentPlayer();
    engine.submitWord(pB.id, 'aax');
    const pA2 = game.getCurrentPlayer();
    expect(pA2.id).toBe(pA.id);
    const dup = engine.submitWord(pA2.id, 'aab');
    expect(dup.success).toBe(false);
    expect(dup.error).toBe('Word already used this game.');

    // Start a fresh game instance -> used words reset
    const game2 = makeGame('aa');
    const engine2 = new GameEngine({
      game: game2,
      emit,
      scheduler,
      eventsPort,
      dictionary,
    });
    const pAnew = game2.getCurrentPlayer();
    const ok = engine2.submitWord(pAnew.id, 'aab');
    expect(ok.success).toBe(true);
  });
});
