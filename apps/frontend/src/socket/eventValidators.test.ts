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
      roomCode: 'ROOM',
      fragment: 'ab',
      bombDuration: 5,
      currentPlayer: 'p1',
      leaderId: 'p1',
      players: [basePlayer],
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.players[0].id).toBe('p1');
  });

  it('validateGameStarted failure on bad types', () => {
    const res = validateGameStarted({});
    expect(res.ok).toBe(false);
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

  it('validatePlayerTypingUpdate success', () => {
    const res = validatePlayerTypingUpdate({ playerId: 'p1', input: 'hi' });
    expect(res.ok).toBe(true);
  });

  it('validatePlayerTypingUpdate failure', () => {
    const res = validatePlayerTypingUpdate({ playerId: 5, input: 'hi' });
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

  it('validateWordAccepted success', () => {
    const res = validateWordAccepted({ playerId: 'p1', word: 'test' });
    expect(res.ok).toBe(true);
  });

  it('validateGameCountdownStarted success', () => {
    const res = validateGameCountdownStarted({ deadline: Date.now() + 1000 });
    expect(res.ok).toBe(true);
  });
});
