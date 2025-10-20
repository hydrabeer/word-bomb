import { describe, it, expect } from 'vitest';
import {
  validateGameStarted,
  validateTurnStarted,
  validatePlayerTypingUpdate,
  validatePlayerUpdated,
  validateGameEnded,
  validateWordAccepted,
  validateGameCountdownStarted,
} from './eventValidators';

const basePlayer = { id: 'p1', name: 'Alice', isEliminated: false, lives: 3 };

describe('eventValidators', () => {
  it('validateGameStarted success', () => {
    const res = validateGameStarted({
      fragment: 'ab',
      bombDuration: 5,
      currentPlayer: 'p1',
      players: [basePlayer],
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.players[0].id).toBe('p1');
  });

  it('validateGameStarted success with nullable currentPlayer', () => {
    const res = validateGameStarted({
      fragment: 'ab',
      bombDuration: 5,
      currentPlayer: null,
      players: [basePlayer],
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.currentPlayer).toBeNull();
    }
  });

  it('validateGameStarted failure on bad types', () => {
    const res = validateGameStarted({});
    expect(res.ok).toBe(false);
  });

  it('validateGameStarted failure when input is not an object', () => {
    // null and primitive should both fail the isObj guard
    expect(validateGameStarted(null).ok).toBe(false);
    expect(validateGameStarted(123 as unknown).ok).toBe(false);
  });

  it('validateTurnStarted success', () => {
    const res = validateTurnStarted({
      playerId: 'p1',
      fragment: 'c',
      bombDuration: 4,
      players: [basePlayer],
    });
    expect(res.ok).toBe(true);
  });

  it('validateTurnStarted failure when input is not an object', () => {
    expect(validateTurnStarted(null).ok).toBe(false);
    expect(validateTurnStarted('x' as unknown).ok).toBe(false);
  });

  it('validateTurnStarted success with nullable playerId', () => {
    const res = validateTurnStarted({
      playerId: null,
      fragment: 'c',
      bombDuration: 4,
      players: [basePlayer],
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.playerId).toBeNull();
  });

  it('validatePlayerTypingUpdate success', () => {
    const res = validatePlayerTypingUpdate({ playerId: 'p1', input: 'hi' });
    expect(res.ok).toBe(true);
  });

  it('validatePlayerTypingUpdate failure', () => {
    const res = validatePlayerTypingUpdate({ playerId: 5, input: 'hi' });
    expect(res.ok).toBe(false);
  });

  it('validatePlayerTypingUpdate failure when input not string', () => {
    const res = validatePlayerTypingUpdate({
      playerId: 'p1',
      input: 123,
    } as unknown);
    expect(res.ok).toBe(false);
  });

  it('validatePlayerUpdated success', () => {
    const res = validatePlayerUpdated({ playerId: 'p1', lives: 2 });
    expect(res.ok).toBe(true);
  });

  it('validateGameEnded variants', () => {
    const r1 = validateGameEnded({ winnerId: 'p1' });
    const r2 = validateGameEnded({ winnerId: null });
    expect(r1.ok && r1.data.winnerId).toBe('p1');
    expect(r2.ok && r2.data.winnerId).toBeNull();
  });

  it('validateGameEnded success when winnerId missing (defaults to null)', () => {
    const res = validateGameEnded({});
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.winnerId).toBeNull();
  });

  it('validateGameEnded failure when input is not an object', () => {
    expect(validateGameEnded(null).ok).toBe(false);
    expect(validateGameEnded(0 as unknown).ok).toBe(false);
  });

  it('validateWordAccepted success', () => {
    const res = validateWordAccepted({ playerId: 'p1', word: 'test' });
    expect(res.ok).toBe(true);
  });

  it('players parsing: isEliminated omitted coerces to false', () => {
    const res = validateGameStarted({
      fragment: 'ab',
      bombDuration: 3,
      currentPlayer: 'p1',
      players: [{ id: 'p1', name: 'A', lives: 2 }],
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.players[0].isEliminated).toBe(false);
  });

  it('validateGameCountdownStarted success', () => {
    const res = validateGameCountdownStarted({ deadline: Date.now() + 1000 });
    expect(res.ok).toBe(true);
  });

  it('validateGameStarted fails on missing currentPlayer (undefined)', () => {
    const bad: unknown = {
      fragment: 'ab',
      bombDuration: 5,
      // currentPlayer omitted -> undefined
      players: [basePlayer],
    };
    const res = validateGameStarted(bad);
    expect(res.ok).toBe(false);
  });

  it('validateGameStarted fails on invalid currentPlayer type', () => {
    const bad: unknown = {
      fragment: 'ab',
      bombDuration: 5,
      currentPlayer: 123,
      players: [basePlayer],
    };
    const res = validateGameStarted(bad);
    expect(res.ok).toBe(false);
  });

  it('validateGameStarted fails when base turn data invalid (fragment/bombDuration types)', () => {
    const bad1: unknown = {
      fragment: 1,
      bombDuration: 5,
      currentPlayer: 'p1',
      players: [basePlayer],
    };
    expect(validateGameStarted(bad1).ok).toBe(false);
    const bad2: unknown = {
      fragment: 'ab',
      bombDuration: '5',
      currentPlayer: 'p1',
      players: [basePlayer],
    };
    expect(validateGameStarted(bad2).ok).toBe(false);
  });

  it('validateGameStarted fails when players invalid', () => {
    // players not an array
    const bad1: unknown = {
      fragment: 'ab',
      bombDuration: 5,
      currentPlayer: 'p1',
      players: {},
    };
    expect(validateGameStarted(bad1).ok).toBe(false);

    // players array with non-object
    const bad2: unknown = {
      fragment: 'ab',
      bombDuration: 5,
      currentPlayer: 'p1',
      players: [1],
    };
    expect(validateGameStarted(bad2).ok).toBe(false);

    // players array with wrong field types
    const bad3: unknown = {
      fragment: 'ab',
      bombDuration: 5,
      currentPlayer: 'p1',
      players: [{ id: 'p1', name: 'n', lives: '3' }],
    };
    expect(validateGameStarted(bad3).ok).toBe(false);
  });

  it('validateTurnStarted fails on missing/invalid playerId', () => {
    const badMissing: unknown = {
      // playerId omitted -> undefined
      fragment: 'c',
      bombDuration: 4,
      players: [basePlayer],
    };
    expect(validateTurnStarted(badMissing).ok).toBe(false);

    const badType: unknown = {
      playerId: 123,
      fragment: 'c',
      bombDuration: 4,
      players: [basePlayer],
    };
    expect(validateTurnStarted(badType).ok).toBe(false);
  });

  it('validateTurnStarted fails when base turn data invalid (fragment/players)', () => {
    const bad1: unknown = {
      playerId: 'p1',
      fragment: 1,
      bombDuration: 4,
      players: [basePlayer],
    };
    expect(validateTurnStarted(bad1).ok).toBe(false);

    const bad2: unknown = {
      playerId: 'p1',
      fragment: 'c',
      bombDuration: 4,
      players: [1],
    };
    expect(validateTurnStarted(bad2).ok).toBe(false);
  });

  it('validatePlayerTypingUpdate failure with non-object', () => {
    const res = validatePlayerTypingUpdate(123 as unknown);
    expect(res.ok).toBe(false);
  });

  it('validatePlayerUpdated failure paths', () => {
    expect(validatePlayerUpdated(123 as unknown).ok).toBe(false);
    expect(
      validatePlayerUpdated({ playerId: 'p1', lives: '2' } as unknown).ok,
    ).toBe(false);
  });

  it('validateGameEnded edge cases', () => {
    // winnerId empty string is allowed by validator
    const r1 = validateGameEnded({ winnerId: '' });
    expect(r1.ok).toBe(true);
    if (r1.ok) expect(r1.data.winnerId).toBe('');

    // non-string non-null should fail
    const r2 = validateGameEnded({ winnerId: 5 } as unknown);
    expect(r2.ok).toBe(false);
  });

  it('validateWordAccepted failure', () => {
    expect(validateWordAccepted(123 as unknown).ok).toBe(false);
    expect(
      validateWordAccepted({ playerId: 'p1', word: 7 } as unknown).ok,
    ).toBe(false);
  });

  it('validateGameCountdownStarted failure', () => {
    expect(validateGameCountdownStarted(123 as unknown).ok).toBe(false);
    expect(
      validateGameCountdownStarted({ deadline: 'soon' } as unknown).ok,
    ).toBe(false);
  });
});
