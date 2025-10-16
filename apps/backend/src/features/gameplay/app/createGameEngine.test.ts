import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TypedServer } from '../../../socket/typedSocket';
import { createGameEngine } from './createGameEngine';
import { Game } from '@game/domain/game/Game';
import { GameRoom } from '@game/domain/rooms/GameRoom';
import { GameRoomRules } from '@game/domain/rooms/GameRoomRules';
import { RoomBroadcaster } from '../../../core/RoomBroadcaster';
import { socketRoomId } from '../../../utils/socketRoomId';
import type { DictionaryPort } from '../../../platform/dictionary';

const rules: GameRoomRules = {
  maxLives: 3,
  startingLives: 3,
  bonusTemplate: new Array(26).fill(1),
  minTurnDuration: 5,
  minWordsPerPrompt: 1,
};

function makeRoomWithTwoSeated(code: string) {
  const room = new GameRoom({ code }, rules);
  room.addPlayer({ id: 'A', name: 'Alice' });
  room.addPlayer({ id: 'B', name: 'Bob' });
  room.setPlayerSeated('A', true);
  room.setPlayerSeated('B', true);
  return room;
}

function makeGameForRoom(room: GameRoom) {
  const players = room.getAllPlayers();
  return new Game({
    roomCode: room.code,
    players,
    currentTurnIndex: 0,
    fragment: 'ar',
    state: 'active',
    rules,
  });
}

function stubDictionary(): DictionaryPort {
  return {
    isValid: () => true,
    getRandomFragment: () => 'aa',
  };
}

describe('createGameEngine wiring', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits to socket room and calls RoomBroadcaster + emitPlayers on gameEnded', () => {
    const room = makeRoomWithTwoSeated('WIRE');
    const game = makeGameForRoom(room);
    // Make both players have 1 life so a single timeout eliminates current
    const a = game.players[0];
    const b = game.players[1];
    while (a.lives > 1) a.loseLife();
    while (b.lives > 1) b.loseLife();
    // Short fuse for deterministic timers
    game.__setBombDurationForTest(1);

    const toSpy = vi.fn(() => ({ emit: emitSpy }));
    const emitSpy = vi.fn();
    const io = { to: toSpy } as unknown as TypedServer;

    // Spy on broadcasting and emitPlayers fanout
    const gameEndedSpy = vi.spyOn(RoomBroadcaster.prototype, 'gameEnded');
    const turnStartedSpy = vi.spyOn(RoomBroadcaster.prototype, 'turnStarted');
    const playersSpy = vi.spyOn(RoomBroadcaster.prototype, 'players');
    const endGameSpy = vi.spyOn(room, 'endGame');

    const engine = createGameEngine(io, room, game, stubDictionary());
    engine.beginGame();

    // turnStarted should broadcast and emit to socket room
    expect(turnStartedSpy).toHaveBeenCalledWith(game);
    expect(toSpy).toHaveBeenCalledWith(socketRoomId(room.code));

    // Advance to trigger timeout -> playerUpdated, potential game over
    vi.advanceTimersByTime(1100);

    // When game ends, RoomBroadcaster.gameEnded is called and room is cleaned
    expect(gameEndedSpy).toHaveBeenCalledTimes(1);
    expect(endGameSpy).toHaveBeenCalled();
    expect(room.game).toBeUndefined();
    expect(playersSpy).toHaveBeenCalled();
    expect(playersSpy.mock.calls[0]?.[0]).toBe(room);

    // Also ensure low-level emitter was used at least once for legacy event
    expect(emitSpy).toHaveBeenCalled();

    // Cleanup spies
    gameEndedSpy.mockRestore();
    turnStartedSpy.mockRestore();
    playersSpy.mockRestore();
    endGameSpy.mockRestore();
  });

  it('cancels scheduled timeout via engine.clearTimeout (covers scheduler.cancel)', () => {
    const room = makeRoomWithTwoSeated('CANC');
    const game = makeGameForRoom(room);
    game.__setBombDurationForTest(5);
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    const toSpy = vi.fn(() => ({ emit: vi.fn() }));
    const io = { to: toSpy } as unknown as TypedServer;

    const engine = createGameEngine(io, room, game, stubDictionary());
    engine.beginGame();
    engine.clearTimeout();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});
