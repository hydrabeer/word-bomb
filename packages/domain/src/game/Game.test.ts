// packages/domain/src/game/Game.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  Game,
  INITIAL_BOMB_DURATION_MIN,
  INITIAL_BOMB_DURATION_MAX,
} from './Game';
import { Player } from '../players/Player';
import { BonusProgress } from '../game/BonusProgress';
import type { GameRoomRules } from '../rooms/GameRoomRules';
import { randomUUID } from 'crypto';

const mockBonusTemplate = new Array(26).fill(1) as number[];

const makeMockPlayer = (name: string, eliminated = false): Player => {
  return new Player({
    id: randomUUID(),
    name,
    isLeader: false,
    isSeated: true,
    isEliminated: eliminated,
    isConnected: true,
    lives: 3,
    bonusProgress: new BonusProgress(mockBonusTemplate),
  });
};

const mockRules: GameRoomRules = {
  maxLives: 3,
  bonusTemplate: mockBonusTemplate,
  minTurnDuration: 5,
  minWordsPerPrompt: 1,
};

describe('Game', () => {
  let game: Game;

  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const player1 = makeMockPlayer('Alice');
    const player2 = makeMockPlayer('Bob');

    game = new Game({
      roomCode: 'ABCD',
      players: [player1, player2],
      currentTurnIndex: 0,
      fragment: 'ing',
      state: 'active',
      rules: mockRules,
    });
  });

  it('initializes correctly with parsed props and bomb timer', () => {
    expect(game.roomCode).toBe('ABCD');
    expect(game.fragment).toBe('ing');
    expect(game.players).toHaveLength(2);
    const expectedDuration =
      Math.floor(
        0.5 * (INITIAL_BOMB_DURATION_MAX - INITIAL_BOMB_DURATION_MIN + 1),
      ) + INITIAL_BOMB_DURATION_MIN;
    expect(game.getBombDuration()).toBe(expectedDuration);
  });

  it('gets the current player', () => {
    const current = game.getCurrentPlayer();
    expect(current.name).toBe('Alice');
  });

  it('advances to next active player', () => {
    game.nextTurn();
    const current = game.getCurrentPlayer();
    expect(current.name).toBe('Bob');
  });

  it('skips eliminated players', () => {
    game.players[1].isEliminated = true;
    game.nextTurn();
    const current = game.getCurrentPlayer();
    expect(current.name).toBe('Alice');
  });

  it('updates the fragment correctly', () => {
    game.setFragment('ous');
    expect(game.fragment).toBe('ous');
  });

  it('throws if no players are active', () => {
    game.players.forEach((p) => (p.isEliminated = true));
    expect(() => game.getCurrentPlayer()).toThrow(
      'No active players remaining',
    );
  });

  it('resets bomb timer to minTurnDuration if too low', () => {
    game.__setBombDurationForTest(3);
    game.adjustBombTimerAfterValidWord();
    expect(game.getBombDuration()).toBe(mockRules.minTurnDuration);
  });

  it('does not adjust bomb timer if above minTurnDuration', () => {
    game.__setBombDurationForTest(8);
    game.adjustBombTimerAfterValidWord();
    expect(game.getBombDuration()).toBe(8);
  });
});
