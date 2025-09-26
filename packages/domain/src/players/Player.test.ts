// packages/domain/src/players/Player.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Player } from './Player';
import { BonusProgress } from '../game/BonusProgress';
import type { PlayerProps } from './Player';
import { randomUUID } from 'crypto';

const bonusTemplate = new Array(26).fill(1) as number[];

const makePlayerProps = (overrides?: Partial<PlayerProps>): PlayerProps => ({
  id: randomUUID(),
  name: 'TestPlayer',
  isLeader: false,
  isSeated: false,
  isEliminated: false,
  isConnected: true,
  lives: 3,
  bonusProgress: new BonusProgress([...bonusTemplate]),
  ...overrides,
});

describe('Player', () => {
  let player: Player;

  beforeEach(() => {
    player = new Player(makePlayerProps());
  });

  it('constructs from valid props', () => {
    expect(player.name).toBe('TestPlayer');
    expect(player.lives).toBe(3);
    expect(player.isEliminated).toBe(false);
    expect(player.bonusProgress).toBeInstanceOf(BonusProgress);
  });

  it('eliminates the player', () => {
    player.eliminate();
    expect(player.isEliminated).toBe(true);
  });

  it('loses a life and eliminates at 0', () => {
    player.lives = 1;
    player.loseLife();
    expect(player.lives).toBe(0);
    expect(player.isEliminated).toBe(true);
  });

  it('does not go below 0 lives', () => {
    player.lives = 0;
    player.loseLife();
    expect(player.lives).toBe(0);
    expect(player.isEliminated).toBe(false); // already false
  });

  it('gains life if below max', () => {
    player.lives = 2;
    player.gainLife(3);
    expect(player.lives).toBe(3);
  });

  it('does not exceed max lives', () => {
    player.lives = 3;
    player.gainLife(3);
    expect(player.lives).toBe(3);
  });

  it('returns false if bonus letter not used', () => {
    const result = player.tryBonusLetter('1', 5, bonusTemplate); // invalid letter
    expect(result).toBe(false);
  });

  it('returns false if bonus not complete after using letter', () => {
    const result = player.tryBonusLetter('a', 5, bonusTemplate);
    expect(result).toBe(false);
    expect(player.lives).toBe(3);
  });

  it('returns true if bonus complete, resets progress and gains life', () => {
    const playerWithOneLetterLeft = new Player(
      makePlayerProps({
        lives: 2,
        bonusProgress: new BonusProgress(
          bonusTemplate.map((_, i) => (i === 0 ? 1 : 0)), // only 'a' left
        ),
      }),
    );

    const result = playerWithOneLetterLeft.tryBonusLetter(
      'a',
      3,
      bonusTemplate,
    );

    expect(result).toBe(true);
    expect(playerWithOneLetterLeft.lives).toBe(3); // gained life
  });

  it('resets player for next game', () => {
    player.isEliminated = true;
    player.isSeated = true;
    player.lives = 0;
    player.resetForNextGame(5, bonusTemplate);

    expect(player.isEliminated).toBe(false);
    expect(player.isSeated).toBe(false);
    expect(player.lives).toBe(5);
  });

  it('fails validation with invalid name', () => {
    expect(
      () =>
        new Player(
          makePlayerProps({ name: '' }), // too short
        ),
    ).toThrow();
  });

  it('fails validation with empty id', () => {
    expect(
      () =>
        new Player(
          // empty string should violate non-empty id rule
          makePlayerProps({ id: '' as unknown as string }),
        ),
    ).toThrow();
  });

  it('fails validation with invalid bonusProgress', () => {
    expect(
      () =>
        new Player(
          makePlayerProps({
            bonusProgress: {} as BonusProgress, // not instance of BonusProgress
          }),
        ),
    ).toThrow();
  });
});
