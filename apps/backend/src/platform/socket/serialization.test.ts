import { describe, it, expect } from 'vitest';
import { Game } from '@game/domain/game/Game';
import { GameRoom } from '@game/domain/rooms/GameRoom';
import { GameRoomRules } from '@game/domain/rooms/GameRoomRules';
import { createPlayer } from '@game/domain/players/createPlayer';

import {
  toRoomPlayerView,
  toGamePlayerView,
  buildPlayersUpdatedPayload,
  buildTurnStartedPayload,
  buildGameStartedPayload,
} from './serialization';

const rules: GameRoomRules = {
  maxLives: 3,
  startingLives: 3,
  bonusTemplate: new Array(26).fill(1),
  minTurnDuration: 5,
  minWordsPerPrompt: 10,
};

function makeRoom(code: string, ...players: [string, string][]) {
  const room = new GameRoom({ code }, rules);
  players.forEach(([id, name]) => room.addPlayer({ id, name }));
  return room;
}

function getRequiredPlayers(room: GameRoom, ...ids: string[]) {
  return ids.map((id) => {
    const player = room.getPlayer(id);
    if (!player) throw new Error(`Player ${id} missing`);
    return player;
  });
}

function makePlayer(
  id: string,
  name: string,
  extra: Partial<ReturnType<typeof createPlayer>> = {},
) {
  return createPlayer({
    id,
    name,
    isLeader: false,
    lives: rules.maxLives,
    bonusTemplate: rules.bonusTemplate,
    ...extra,
  });
}

function makeGame(roomCode: string) {
  const p1 = makePlayer('P1', 'Alice');
  const p2 = makePlayer('P2', 'Bob');
  const game = new Game({
    roomCode,
    players: [p1, p2],
    currentTurnIndex: 0,
    fragment: 'ar',
    state: 'active',
    rules,
  });
  return { game, p1, p2 };
}

describe('serialization player views', () => {
  it('toRoomPlayerView returns seating-focused fields', () => {
    const player = makePlayer('X', 'Xena');
    player.isSeated = true;
    player.isConnected = false;
    const view = toRoomPlayerView(player);
    expect(view).toEqual({
      id: 'X',
      name: 'Xena',
      isSeated: true,
      isConnected: false,
    });
  });

  it('toGamePlayerView returns in-game state fields', () => {
    const player = makePlayer('Y', 'Yuri');
    player.lives = 2;
    player.isSeated = true;
    player.isConnected = false;
    player.isEliminated = true;
    const view = toGamePlayerView(player, {
      maxLives: rules.maxLives,
      startingLives: rules.startingLives,
      bonusTemplate: rules.bonusTemplate,
      minTurnDuration: rules.minTurnDuration,
      minWordsPerPrompt: rules.minWordsPerPrompt,
    });
    expect(view.id).toBe('Y');
    expect(view.name).toBe('Yuri');
    expect(view.isEliminated).toBe(true);
    expect(view.lives).toBe(2);
    expect(view.bonusProgress).toBeDefined();
    expect(view.bonusProgress?.remaining.length).toBe(26);
    expect(view.bonusProgress?.total.length).toBe(26);
    expect(view.isConnected).toBe(false);
  });
});

describe('serialization payload builders', () => {
  it('buildPlayersUpdatedPayload includes leader id and players', () => {
    const room = makeRoom('ABCD', ['L', 'Leader'], ['S', 'Sam']);
    room.setPlayerSeated('S', true);
    const payload = buildPlayersUpdatedPayload(room);
    expect(payload.leaderId).toBe('L');
    expect(payload.players.length).toBe(2);
    expect(payload.players.find((p) => p.id === 'S')?.isSeated).toBe(true);
  });

  it('buildPlayersUpdatedPayload omits leader id when none exists', () => {
    const room = makeRoom('EMPT');
    const payload = buildPlayersUpdatedPayload(room);
    expect(payload.leaderId).toBeUndefined();
    expect(payload.players).toEqual([]);
  });

  it('buildTurnStartedPayload reflects current player and fragment', () => {
    const { game, p1 } = makeGame('ROOM');
    // ensure p1 is current
    const payload = buildTurnStartedPayload(game);
    expect(payload.playerId).toBe(p1.id);
    expect(payload.fragment).toBe('ar');
    expect(payload.players.length).toBe(2);
  });

  it('buildGameStartedPayload composes game start snapshot', () => {
    const room = makeRoom('WXYZ', ['A', 'Alpha'], ['B', 'Beta']);
    const [pA, pB] = getRequiredPlayers(room, 'A', 'B');

    const game = new Game({
      roomCode: room.code,
      players: [pA, pB],
      currentTurnIndex: 0,
      fragment: 'xy',
      state: 'active',
      rules,
    });

    const payload = buildGameStartedPayload(game);
    expect(payload.currentPlayer).toBe(pA.id);
    expect(payload.players.map((p) => p.id)).toEqual(['A', 'B']);
  });

  it('buildGameStartedPayload reflects current game state even with empty room', () => {
    const room = makeRoom('NULL', ['A', 'Alpha'], ['B', 'Beta']);
    const [pA, pB] = getRequiredPlayers(room, 'A', 'B');

    room.removePlayer('A');
    room.removePlayer('B');

    const game = new Game({
      roomCode: 'NULL',
      players: [pA, pB],
      currentTurnIndex: 1,
      fragment: 'zz',
      state: 'active',
      rules,
    });

    const payload = buildGameStartedPayload(game);
    expect(payload.currentPlayer).toBe(pB.id);
    expect(payload.players.length).toBe(2);
  });
});
