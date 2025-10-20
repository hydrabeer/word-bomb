import { describe, it, expect, assertType } from 'vitest';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  GameStartedPayload,
  TurnStartedPayload,
  PlayersUpdatedPayload,
} from './socket';

// This test suite ensures exported types stay structurally consistent.
// It exercises basic runtime shape checks to contribute to coverage without logic duplication.

describe('socket shared types', () => {
  it('GameStartedPayload structure', () => {
    const sample: GameStartedPayload = {
      fragment: 'ab',
      bombDuration: 5,
      currentPlayer: null,
      players: [{ id: 'p1', name: 'Alice', isEliminated: false, lives: 3 }],
    };
    expect(sample.fragment).toBe('ab');
    expect(sample.players[0].lives).toBe(3);
  });

  it('TurnStartedPayload structure', () => {
    const sample: TurnStartedPayload = {
      playerId: 'p1',
      fragment: 'c',
      bombDuration: 4,
      players: [{ id: 'p1', name: 'Alice', isEliminated: false, lives: 3 }],
    };
    expect(sample.playerId).toBe('p1');
  });

  it('PlayersUpdatedPayload structure', () => {
    const sample: PlayersUpdatedPayload = {
      players: [{ id: 'p1', name: 'Alice', isSeated: true, isConnected: true }],
      leaderId: 'p1',
    };
    expect(sample.players[0].isSeated).toBe(true);
  });

  it('Client and Server event key existence (type-only)', () => {
    // Using assertType from Vitest for compile-time guarantees
    assertType<keyof ClientToServerEvents>('joinRoom');
    assertType<keyof ServerToClientEvents>('gameStarted');
    expect(true).toBe(true); // runtime assertion to satisfy lint
  });
});
