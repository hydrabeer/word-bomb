import { describe, it, expect } from 'vitest';
import {
  parseCountdownStarted,
  parseGameStarted,
  parseTurnStarted,
  parsePlayerTypingUpdate,
  parsePlayerUpdated,
  parseGameEnded,
  parseWordAccepted,
  parseActionAck,
} from './parsers';

describe('socket parsers', () => {
  it('parseCountdownStarted valid', () => {
    expect(parseCountdownStarted({ deadline: 123 })).toEqual({ deadline: 123 });
  });
  it('parseCountdownStarted invalid', () => {
    expect(parseCountdownStarted({})).toBeNull();
  });
  it('parseGameStarted minimal valid', () => {
    const res = parseGameStarted({
      fragment: 'ab',
      bombDuration: 5,
      players: [],
      currentPlayer: null,
    });
    expect(res?.fragment).toBe('ab');
  });
  it('parseTurnStarted valid', () => {
    const res = parseTurnStarted({
      fragment: 'c',
      bombDuration: 4,
      players: [],
      playerId: null,
    });
    expect(res?.bombDuration).toBe(4);
  });
  it('parsePlayerTypingUpdate valid', () => {
    expect(parsePlayerTypingUpdate({ playerId: 'p1', input: 'x' })).toEqual({
      playerId: 'p1',
      input: 'x',
    });
  });
  it('parsePlayerUpdated valid', () => {
    expect(parsePlayerUpdated({ playerId: 'p1', lives: 2 })).toEqual({
      playerId: 'p1',
      lives: 2,
    });
  });
  it('parseGameEnded variants', () => {
    expect(parseGameEnded({ winnerId: 'p1' })?.winnerId).toBe('p1');
    expect(parseGameEnded({})?.winnerId).toBeNull();
  });
  it('parseWordAccepted valid', () => {
    expect(parseWordAccepted({ playerId: 'p1', word: 'test' })).toEqual({
      playerId: 'p1',
      word: 'test',
    });
  });
  it('parseActionAck valid', () => {
    expect(
      parseActionAck({ clientActionId: 'id', success: true })?.clientActionId,
    ).toBe('id');
  });
  it('parseActionAck invalid', () => {
    expect(parseActionAck({ clientActionId: 5, success: true })).toBeNull();
  });
});
