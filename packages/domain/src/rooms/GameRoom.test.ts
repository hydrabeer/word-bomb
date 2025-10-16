import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameRoom, normalizeRoomVisibility } from './GameRoom';
import type { GameRoomRules } from './GameRoomRules';
import { randomUUID } from 'crypto';
import { PlayerProps, PlayerSchema } from '../players/Player';
import { BonusProgress } from '../game/BonusProgress';
import type { Game } from '../game/Game';

const bonusTemplate: number[] = Array.from({ length: 26 }, () => 1);

const mockRules: GameRoomRules = {
  maxLives: 3,
  startingLives: 3,
  bonusTemplate,
  minTurnDuration: 5,
  minWordsPerPrompt: 1,
};

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

describe('GameRoom', () => {
  let room: GameRoom;

  beforeEach(() => {
    room = new GameRoom({ code: 'ABCD' }, mockRules);
  });

  it('creates a new room with code and rules', () => {
    expect(room.code).toBe('ABCD');
    expect(room.getAllPlayers()).toHaveLength(0);
    expect(room.visibility).toBe('private');
  });

  it('allows visibility overrides during construction', () => {
    const publicRoom = new GameRoom({ code: 'PUBA' }, mockRules, {
      visibility: 'public',
    });
    expect(publicRoom.visibility).toBe('public');
  });

  it('normalizes unexpected casing during construction', () => {
    const loudRoom = new GameRoom({ code: 'LOUD' }, mockRules, {
      visibility: 'PUBLIC' as unknown as 'public',
    });

    expect(loudRoom.visibility).toBe('public');
  });

  it('adds a player and assigns leader if first', () => {
    const playerProps = makePlayerProps();
    room.addPlayer(playerProps);

    expect(room.hasPlayer(playerProps.id)).toBe(true);
    expect(room.getLeaderId()).toBe(playerProps.id);
  });

  it('throws when adding a player with duplicate ID', () => {
    const playerProps = makePlayerProps();
    room.addPlayer(playerProps);
    expect(() => {
      room.addPlayer(playerProps);
    }).toThrow('Player already in room.');
  });

  it('removes a player and assigns new leader', () => {
    const p1 = makePlayerProps();
    const p2 = makePlayerProps();
    room.addPlayer(p1);
    room.addPlayer(p2);

    room.removePlayer(p1.id);

    expect(room.hasPlayer(p1.id)).toBe(false);
    expect(room.getLeaderId()).toBe(p2.id);
  });

  it('sets player seating state', () => {
    const p = makePlayerProps();
    room.addPlayer(p);
    room.setPlayerSeated(p.id, true);

    const result = room.getPlayer(p.id);
    expect(result?.isSeated).toBe(true);
  });

  it('updatePlayerName returns false when player is missing', () => {
    expect(room.updatePlayerName('missing', 'NewName')).toBe(false);
  });

  it('updatePlayerName ignores unchanged names without parsing', () => {
    const p = makePlayerProps({ name: 'SameName' });
    room.addPlayer(p);

    const parseSpy = vi.spyOn(PlayerSchema.shape.name, 'parse');

    expect(room.updatePlayerName(p.id, 'SameName')).toBe(true);
    expect(parseSpy).not.toHaveBeenCalled();

    parseSpy.mockRestore();
  });

  it('updatePlayerName validates and applies new names', () => {
    const p = makePlayerProps({ name: 'OldName' });
    room.addPlayer(p);

    const parseSpy = vi.spyOn(PlayerSchema.shape.name, 'parse');

    expect(room.updatePlayerName(p.id, 'NewName')).toBe(true);
    expect(parseSpy).toHaveBeenCalledWith('NewName');
    expect(room.getPlayer(p.id)?.name).toBe('NewName');

    parseSpy.mockRestore();
  });

  it('updates player connectivity without removing them', () => {
    const p = makePlayerProps({ isConnected: true });
    room.addPlayer(p);
    room.setPlayerConnected(p.id, false);
    expect(room.getPlayer(p.id)?.isConnected).toBe(false);

    room.setPlayerConnected('missing-id', true); // no throw, no effect
    expect(room.getPlayer(p.id)?.isConnected).toBe(false);
  });

  it('throws when starting game with fewer than 2 seated players', () => {
    const p = makePlayerProps();
    room.addPlayer(p);
    room.setPlayerSeated(p.id, true);
    expect(() => {
      room.startGame();
    }).toThrow('Need at least 2 players seated to start the game');
  });

  it('sets leaderId to null if no players remain after removal', () => {
    const p1 = makePlayerProps();
    room.addPlayer(p1);

    room.removePlayer(p1.id); // triggers assignNewLeader()

    expect(room.getLeaderId()).toBeNull();
  });

  it('starts game with 2+ seated players and resets them', () => {
    const p1 = makePlayerProps();
    const p2 = makePlayerProps();
    room.addPlayer(p1);
    room.addPlayer(p2);

    room.setPlayerSeated(p1.id, true);
    room.setPlayerSeated(p2.id, true);

    const player1 = room.getPlayer(p1.id);
    const player2 = room.getPlayer(p2.id);

    expect(player1).toBeDefined();
    expect(player2).toBeDefined();

    if (!player1 || !player2) {
      throw new Error(
        'Players should be defined after being added to the room',
      );
    }
    const spy1 = vi.spyOn(player1, 'resetForNextGame');
    const spy2 = vi.spyOn(player2, 'resetForNextGame');

    room.startGame();

    expect(spy1).toHaveBeenCalledOnce();
    expect(spy2).toHaveBeenCalledOnce();
  });

  it('ends the game and clears seated flags', () => {
    const p1 = makePlayerProps({ isSeated: true });
    const p2 = makePlayerProps({ isSeated: true });
    room.addPlayer(p1);
    room.addPlayer(p2);

    room.endGame();

    const player1 = room.getPlayer(p1.id);
    const player2 = room.getPlayer(p2.id);

    expect(player1?.isSeated).toBe(false);
    expect(player2?.isSeated).toBe(false);
  });

  it('updateRules applies validated changes and caps lives', () => {
    const p1 = makePlayerProps();
    const p2 = makePlayerProps();
    room.addPlayer(p1);
    room.addPlayer(p2);
    const player = room.getPlayer(p1.id);
    expect(player).toBeDefined();
    if (!player) throw new Error('player missing');
    player.lives = 5;
    player.bonusProgress.reset(Array.from({ length: 26 }, () => 1));

    const nextRules: GameRoomRules = {
      maxLives: 4,
      startingLives: 2,
      bonusTemplate: Array.from({ length: 26 }, () => 2),
      minTurnDuration: 6,
      minWordsPerPrompt: 200,
    };

    room.updateRules(nextRules);

    expect(room.rules).toEqual(nextRules);
    expect(player.lives).toBe(4);
    expect(player.bonusProgress.toArray()).toEqual(nextRules.bonusTemplate);
  });

  it('updateRules throws while game active', () => {
    room.game = {} as unknown as Game;
    expect(() => {
      room.updateRules({ ...mockRules, startingLives: 2 });
    }).toThrow('Cannot change rules while a game is running.');
  });

  it('starts and cancels game start timer', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    room.startGameStartTimer(() => {
      callback();
    }, 1000);
    expect(room.isGameTimerRunning()).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledOnce();
    expect(room.isGameTimerRunning()).toBe(false);

    vi.useRealTimers();
  });

  it('does not start duplicate timers', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    room.startGameStartTimer(() => {
      callback();
    }, 1000);

    room.startGameStartTimer(() => {
      callback();
    }, 1000); // ignored

    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledOnce();

    vi.useRealTimers();
  });

  it('cancels a running timer', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    room.startGameStartTimer(() => {
      callback();
    }, 1000);

    room.cancelGameStartTimer();

    expect(room.isGameTimerRunning()).toBe(false);

    vi.advanceTimersByTime(1000);
    expect(callback).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});

describe('normalizeRoomVisibility', () => {
  it('returns fallback for non-string values', () => {
    expect(normalizeRoomVisibility(undefined)).toBe('private');
    expect(normalizeRoomVisibility(42, 'public')).toBe('public');
  });

  it('honours valid visibility values regardless of casing or whitespace', () => {
    expect(normalizeRoomVisibility(' PUBLIC ')).toBe('public');
    expect(normalizeRoomVisibility('private')).toBe('private');
    expect(normalizeRoomVisibility('PriVaTe')).toBe('private');
  });

  it('falls back when visibility is unknown', () => {
    expect(normalizeRoomVisibility('friends-only')).toBe('private');
    expect(normalizeRoomVisibility('friends-only', 'public')).toBe('public');
  });
});
