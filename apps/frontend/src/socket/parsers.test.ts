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
    expect(parseCountdownStarted(5)).toBeNull();
    expect(parseCountdownStarted(null)).toBeNull();
  });
  it('parseGameStarted minimal valid', () => {
    const res = parseGameStarted({
      fragment: 'ab',
      bombDuration: 5,
      players: [],
      currentPlayer: null,
    });
    expect(res?.fragment).toBe('ab');
    expect(res?.currentPlayer).toBeNull();
  });
  it('parseGameStarted with players mapping and currentPlayer string', () => {
    const res = parseGameStarted({
      fragment: 'xy',
      bombDuration: 10,
      currentPlayer: 'p1',
      players: [
        {
          id: 'p1',
          name: 'Alice',
          isEliminated: 'yes', // truthy -> true
          lives: 3,
          bonusProgress: { remaining: [1, 'x', 2], total: [5, null, 6] },
        },
        42, // non-object -> defaults
      ],
    });
    expect(res).not.toBeNull();
    expect(res!.currentPlayer).toBe('p1');
    expect(res!.players[0]).toEqual({
      id: 'p1',
      name: 'Alice',
      isEliminated: true,
      lives: 3,
      bonusProgress: { remaining: [1, 2], total: [5, 6] },
    });
    expect(res!.players[1]).toEqual({
      id: 'unknown',
      name: 'Unknown',
      isEliminated: false,
      lives: 0,
    });
  });
  it('parseGameStarted with bonusProgress shape invalid -> omitted', () => {
    const res = parseGameStarted({
      fragment: 'zz',
      bombDuration: 1,
      players: [
        {
          id: 'p2',
          name: 'Bob',
          isEliminated: false,
          lives: 1,
          bonusProgress: { remaining: 'nope', total: 123 },
        },
      ],
    });
    expect(res!.players[0]).toEqual({
      id: 'p2',
      name: 'Bob',
      isEliminated: false,
      lives: 1,
      // bonusProgress intentionally omitted
    });
  });
  it('parseGameStarted player object with invalid fields falls back', () => {
    const res = parseGameStarted({
      fragment: 'fb',
      bombDuration: 9,
      players: [
        {
          id: 123,
          name: null,
          lives: 'NaN',
          // isEliminated missing -> false
          bonusProgress: 5,
        } as unknown as Record<string, unknown>,
      ],
    });
    expect(res!.players[0]).toEqual({
      id: 'unknown',
      name: 'Unknown',
      isEliminated: false,
      lives: 0,
    });
  });
  it('parseGameStarted invalid variants', () => {
    expect(parseGameStarted(null)).toBeNull();
    expect(
      parseGameStarted({ fragment: 1, bombDuration: 5, players: [] }),
    ).toBeNull();
    expect(
      parseGameStarted({ fragment: 'ok', bombDuration: '5', players: [] }),
    ).toBeNull();
    expect(
      parseGameStarted({ fragment: 'ok', bombDuration: 5, players: {} }),
    ).toBeNull();
    // currentPlayer absent -> null
    const noCp = parseGameStarted({ fragment: 'ok', bombDuration: 5, players: [] });
    expect(noCp!.currentPlayer).toBeNull();
    // currentPlayer present but not string/null -> null via fallback branch
    const badCp = parseGameStarted({ fragment: 'ok', bombDuration: 5, players: [], currentPlayer: 123 });
    expect(badCp!.currentPlayer).toBeNull();
  });
  it('parseTurnStarted valid', () => {
    const res = parseTurnStarted({
      fragment: 'c',
      bombDuration: 4,
      players: [],
      playerId: null,
    });
    expect(res?.bombDuration).toBe(4);
    expect(res?.playerId).toBeNull();
  });
  it('parseTurnStarted with player and bonusProgress', () => {
    const res = parseTurnStarted({
      fragment: 'q',
      bombDuration: 7,
      playerId: 'p1',
      players: [
        {
          id: 'p1',
          name: 'Alice',
          isEliminated: 0,
          lives: 2,
          bonusProgress: { remaining: [0, 1], total: [2, 3] },
        },
      ],
    });
    expect(res!.playerId).toBe('p1');
    expect(res!.players[0].bonusProgress).toEqual({ remaining: [0, 1], total: [2, 3] });
  });
  it('parseTurnStarted maps non-object player to defaults', () => {
    const res = parseTurnStarted({
      fragment: 'd',
      bombDuration: 2,
      playerId: 999, // non-string -> pickStringOrNull fallback
      players: [42], // non-object -> default player entry
    });
    expect(res!.playerId).toBeNull();
    expect(res!.players[0]).toEqual({ id: 'unknown', name: 'Unknown', isEliminated: false, lives: 0 });
  });
  it('parseTurnStarted invalid variants', () => {
    expect(parseTurnStarted('no')).toBeNull();
    expect(parseTurnStarted({ fragment: 1, bombDuration: 1, players: [] })).toBeNull();
    expect(parseTurnStarted({ fragment: 'c', bombDuration: '1', players: [] })).toBeNull();
    expect(parseTurnStarted({ fragment: 'c', bombDuration: 1, players: {} })).toBeNull();
  });
  it('parseTurnStarted player object with invalid fields falls back', () => {
    const res = parseTurnStarted({
      fragment: 'fb',
      bombDuration: 3,
      playerId: null,
      players: [
        {
          id: undefined,
          name: 42,
          isEliminated: undefined,
          lives: undefined,
          bonusProgress: { remaining: [1], total: 'bad' }, // invalid shape -> omitted
        } as unknown as Record<string, unknown>,
      ],
    });
    expect(res!.players[0]).toEqual({
      id: 'unknown',
      name: 'Unknown',
      isEliminated: false,
      lives: 0,
    });
  });
  it('parsePlayerTypingUpdate valid', () => {
    expect(parsePlayerTypingUpdate({ playerId: 'p1', input: 'x' })).toEqual({
      playerId: 'p1',
      input: 'x',
    });
  });
  it('parsePlayerTypingUpdate invalid', () => {
    expect(parsePlayerTypingUpdate({ playerId: 1, input: 'x' })).toBeNull();
    expect(parsePlayerTypingUpdate({ playerId: 'p1', input: 2 })).toBeNull();
    expect(parsePlayerTypingUpdate('bad')).toBeNull();
  });
  it('parsePlayerUpdated valid', () => {
    expect(parsePlayerUpdated({ playerId: 'p1', lives: 2 })).toEqual({
      playerId: 'p1',
      lives: 2,
    });
  });
  it('parsePlayerUpdated invalid', () => {
    expect(parsePlayerUpdated({ playerId: 'p1', lives: '2' })).toBeNull();
    expect(parsePlayerUpdated({ playerId: 5, lives: 2 })).toBeNull();
    expect(parsePlayerUpdated(null)).toBeNull();
  });
  it('parseGameEnded variants', () => {
    expect(parseGameEnded({ winnerId: 'p1' })?.winnerId).toBe('p1');
    expect(parseGameEnded({})?.winnerId).toBeNull();
    expect(parseGameEnded({ winnerId: 123 })).toBeNull();
    expect(parseGameEnded('bad')).toBeNull();
  });
  it('parseWordAccepted valid', () => {
    expect(parseWordAccepted({ playerId: 'p1', word: 'test' })).toEqual({
      playerId: 'p1',
      word: 'test',
    });
  });
  it('parseWordAccepted invalid', () => {
    expect(parseWordAccepted({ playerId: 'p1', word: 5 })).toBeNull();
    expect(parseWordAccepted({ playerId: 1, word: 'ok' })).toBeNull();
    expect(parseWordAccepted(undefined)).toBeNull();
  });
  it('parseActionAck valid', () => {
    expect(
      parseActionAck({ clientActionId: 'id', success: true })?.clientActionId,
    ).toBe('id');
  });
  it('parseActionAck invalid', () => {
    expect(parseActionAck({ clientActionId: 5, success: true })).toBeNull();
  });
  it('parseActionAck with error string and non-string', () => {
    expect(
      parseActionAck({ clientActionId: 'id2', success: false, error: 'boom' }),
    ).toEqual({ clientActionId: 'id2', success: false, error: 'boom' });
    expect(
      parseActionAck({ clientActionId: 'id3', success: false, error: 123 }),
    ).toEqual({ clientActionId: 'id3', success: false });
  });
  it('parseActionAck non-object input invalid', () => {
    expect(parseActionAck(null)).toBeNull();
    expect(parseActionAck('nope')).toBeNull();
  });
});
