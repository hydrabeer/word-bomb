import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupTestServer, withServer } from '../../test/helpers';
import { roomManager } from '../room/roomManagerSingleton';
import { getGameEngine } from '../game/engineRegistry';
import { createLogger } from '../logging';
import type { TestContext } from '../../test/helpers';

import type {
  PlayersUpdatedPayload,
  PlayersDiffPayload,
  ActionAckPayload,
  RoomRulesPayload,
  PlayerUpdatedPayload,
  GameEndedPayload,
  BasicResponse,
  ChatMessagePayload,
} from '@word-bomb/types/socket';
import { setDisconnectGrace } from './roomHandlers';

const testLogger = createLogger({ service: 'backend-tests' });

async function canStartServer(): Promise<boolean> {
  try {
    const ctx = await setupTestServer();
    await ctx.close();
    return true;
  } catch (error) {
    testLogger.warn(
      { event: 'test_server_unavailable', err: error },
      'Skipping roomHandlers integration tests',
    );
    return false;
  }
}

const serverAvailable = await canStartServer();
const describeRoomHandlers = serverAvailable ? describe : describe.skip;
const useServer: () => TestContext = serverAvailable
  ? withServer()
  : () => {
      throw new Error('Room handler test server unavailable');
    };

// helpers
import {
  joinRoom,
  waitForConnect,
  setPlayerSeated as setSeated,
  startGame,
  ensureRoom,
  requireId,
  createRoomCode,
  waitForPlayersCount,
  waitForDiff,
  waitForActionAck,
} from '../../test/testUtils';

// Removed duplicate function definitions and unused types

// NOTE: We mock the dictionary BEFORE any game/engine modules are imported via server helpers
// so that GameEngine validation will always accept words and fragment is deterministic.
vi.mock('../dictionary', async () => {
  const actual =
    await vi.importActual<typeof import('../dictionary')>('../dictionary');
  return {
    ...actual,
    isValidWord: () => true,
    getRandomFragment: () => 'aa',
    createDictionaryPort: () => ({
      isValid: () => true,
      getRandomFragment: () => 'aa',
    }),
  };
});

describeRoomHandlers('roomHandlers integration', () => {
  beforeEach(() => {
    roomManager.clear();
  });

  it('allows a player to join a room (idempotent)', async () => {
    const ctx = useServer();
    const code = createRoomCode();
    ensureRoom(code);
    const sock = ctx.createClient();
    await waitForConnect(sock);
    const playerId = requireId(sock.id);
    const firstJoinWait = waitForPlayersCount(sock, 1);
    const first = await joinRoom(sock, {
      roomCode: code,
      playerId,
      name: 'Alice',
    });
    const payload = await firstJoinWait;
    // Second join (idempotent reconnection path) - set listener before emitting
    const secondJoinWait = waitForPlayersCount(sock, 1);
    const second = await joinRoom(sock, {
      roomCode: code,
      playerId,
      name: 'Alice',
    });
    await secondJoinWait; // expect another emission but still 1 player
    const ids = payload.players.map((p: { id: string }) => p.id);
    expect(new Set(ids).size).toBe(1);
    expect(first.success).toBe(true);
    expect(second.success).toBe(true); // no error on duplicate join (server just ignores)
  });

  it('sends current rules to joining players', async () => {
    const ctx = useServer();
    const code = createRoomCode();
    ensureRoom(code);
    const sock = ctx.createClient();
    await waitForConnect(sock);
    const playerId = requireId(sock.id);
    const rulesEvents: RoomRulesPayload[] = [];
    sock.on('roomRulesUpdated', (payload) => {
      rulesEvents.push(payload);
    });
    const rulesWait = new Promise<RoomRulesPayload>((resolve) => {
      sock.once('roomRulesUpdated', (p) => {
        resolve(p);
      });
    });
    await joinRoom(sock, {
      roomCode: code,
      playerId,
      name: 'Viewer',
    });
    const latest = await rulesWait;
    expect(rulesEvents.length).toBeGreaterThan(0);
    expect(latest.rules.maxLives).toBe(3);
    expect(latest.roomCode).toBe(code);
  });

  it('broadcasts playersUpdated with 2 players', async () => {
    const ctx = useServer();
    const code = createRoomCode();
    ensureRoom(code);
    const s1 = ctx.createClient();
    const s2 = ctx.createClient();
    await Promise.all([waitForConnect(s1), waitForConnect(s2)]);
    const p1 = requireId(s1.id);
    const p2 = requireId(s2.id);
    const updates: PlayersUpdatedPayload[] = [];
    s1.on('playersUpdated', (p) => {
      updates.push(p);
    });
    const firstAdd = waitForPlayersCount(s1, 1);
    await joinRoom(s1, { roomCode: code, playerId: p1, name: 'P1' });
    await firstAdd;
    const secondAdd = waitForPlayersCount(s1, 2);
    await joinRoom(s2, { roomCode: code, playerId: p2, name: 'P2' });
    await secondAdd;
    expect(updates.at(-1)?.players.length).toBe(2);
  });

  it('starts and cancels countdown via seating changes', async () => {
    const ctx = useServer();
    const code = createRoomCode();
    ensureRoom(code);
    const s1 = ctx.createClient();
    const s2 = ctx.createClient();
    await Promise.all([waitForConnect(s1), waitForConnect(s2)]);
    const p1 = requireId(s1.id);
    const p2 = requireId(s2.id);
    let countdownStarted = 0;
    let countdownStopped = 0;
    s1.on('gameCountdownStarted', () => {
      countdownStarted += 1;
    });
    s1.on('gameCountdownStopped', () => {
      countdownStopped += 1;
    });
    const joinA = waitForPlayersCount(s1, 1);
    await joinRoom(s1, { roomCode: code, playerId: p1, name: 'A' });
    await joinA;
    const joinB = waitForPlayersCount(s1, 2);
    await joinRoom(s2, { roomCode: code, playerId: p2, name: 'B' });
    await joinB;
    await setSeated(s1, { roomCode: code, playerId: p1, seated: true });
    const countdownPromise = new Promise<void>((resolve) => {
      s1.once('gameCountdownStarted', () => {
        resolve();
      });
    });
    await setSeated(s2, { roomCode: code, playerId: p2, seated: true });
    await countdownPromise;
    expect(countdownStarted).toBe(1);
    const stopPromise = new Promise<void>((resolve) => {
      s1.once('gameCountdownStopped', () => {
        resolve();
      });
    });
    await setSeated(s2, { roomCode: code, playerId: p2, seated: false });
    await stopPromise;
    expect(countdownStopped).toBe(1);
  });

  it('prevents game start with < 2 seated players', async () => {
    const ctx = useServer();
    const code = createRoomCode();
    ensureRoom(code);
    const s1 = ctx.createClient();
    await waitForConnect(s1);
    const p1 = requireId(s1.id);
    await joinRoom(s1, { roomCode: code, playerId: p1, name: 'Solo' });
    await setSeated(s1, { roomCode: code, playerId: p1, seated: true });
    const res = await startGame(s1, code);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Need at least 2/);
  });

  it('allows game start with 2 seated players', async () => {
    const ctx = useServer();
    const code = createRoomCode();
    ensureRoom(code);
    const s1 = ctx.createClient();
    const s2 = ctx.createClient();
    await Promise.all([waitForConnect(s1), waitForConnect(s2)]);
    const p1 = requireId(s1.id);
    const p2 = requireId(s2.id);
    const addA = waitForPlayersCount(s1, 1);
    await joinRoom(s1, { roomCode: code, playerId: p1, name: 'A' });
    await addA;
    const addB = waitForPlayersCount(s1, 2);
    await joinRoom(s2, { roomCode: code, playerId: p2, name: 'B' });
    await addB;
    await setSeated(s1, { roomCode: code, playerId: p1, seated: true });
    await setSeated(s2, { roomCode: code, playerId: p2, seated: true });
    const res = await startGame(s1, code);
    expect(res.success).toBe(true);
  });

  it('marks player disconnected then reconnected (diff events)', async () => {
    const ctx = useServer();
    const code = createRoomCode();
    ensureRoom(code);
    const observer = ctx.createClient();
    const s1 = ctx.createClient();
    await Promise.all([waitForConnect(observer), waitForConnect(s1)]);
    const pObserver = requireId(observer.id);
    const p1 = requireId(s1.id);
    const diffEvents: PlayersDiffPayload[] = [];
    observer.on('playersDiff', (d) => {
      diffEvents.push(d);
    });
    const addObserver = waitForPlayersCount(observer, 1);
    await joinRoom(observer, {
      roomCode: code,
      playerId: pObserver,
      name: 'Obs',
    });
    await addObserver;
    const diffAddPromise = waitForDiff(observer, (d: PlayersDiffPayload) => {
      const ok: boolean = d.added.some((a: { id: string }) => a.id === p1);
      return ok;
    });
    await joinRoom(s1, { roomCode: code, playerId: p1, name: 'Alpha' });
    await diffAddPromise;
    const disconnectDiff = waitForDiff(observer, (d: PlayersDiffPayload) => {
      const ok: boolean = d.updated.some(
        (u: { id: string; changes: { isConnected?: boolean } }) =>
          u.id === p1 && u.changes.isConnected === false,
      );
      return ok;
    });
    s1.disconnect();
    await disconnectDiff;
    const s1b = ctx.createClient();
    await waitForConnect(s1b);
    const reconnectDiff = waitForDiff(observer, (d: PlayersDiffPayload) => {
      const ok: boolean = d.updated.some(
        (u: { id: string; changes: { isConnected?: boolean } }) =>
          u.id === p1 && u.changes.isConnected === true,
      );
      return ok;
    });
    const reconnectSystemMessage = new Promise<ChatMessagePayload>(
      (resolve, reject) => {
        const timeout = setTimeout(() => {
          observer.off('chatMessage', handler);
          reject(new Error('Timed out waiting for reconnect system message'));
        }, 700);
        function handler(msg: ChatMessagePayload) {
          if (msg.type === 'system' && /reconnected/i.test(msg.message)) {
            clearTimeout(timeout);
            observer.off('chatMessage', handler);
            resolve(msg);
          }
        }
        observer.on('chatMessage', handler);
      },
    );
    await joinRoom(s1b, { roomCode: code, playerId: p1, name: 'Alpha' });
    await reconnectDiff;
    const reconnectMessage = await reconnectSystemMessage;
    expect(reconnectMessage.message).toBe('Alpha reconnected.');
    const flattenedUpdates = diffEvents.flatMap((e: PlayersDiffPayload) => {
      const arr: { id: string; changes: { isConnected?: boolean } }[] =
        e.updated;
      return arr;
    });
    const hasDisconnect = flattenedUpdates.some(
      (u) => u.changes.isConnected === false,
    );
    const hasReconnect = flattenedUpdates.some(
      (u) => u.changes.isConnected === true,
    );
    expect(hasDisconnect || hasReconnect).toBe(true); // at least one connectivity change observed
    expect(hasReconnect).toBe(true);
  });

  it('announces only disconnect for already eliminated players', async () => {
    const ctx = useServer();
    const code = createRoomCode();
    ensureRoom(code);
    const observer = ctx.createClient();
    const s1 = ctx.createClient();
    await Promise.all([waitForConnect(observer), waitForConnect(s1)]);
    const observerId = requireId(observer.id);
    const p1 = requireId(s1.id);

    const chatHistory: ChatMessagePayload[] = [];
    const historyHandler = (msg: ChatMessagePayload) => {
      chatHistory.push(msg);
    };
    observer.on('chatMessage', historyHandler);

    const addObserver = waitForPlayersCount(observer, 1);
    await joinRoom(observer, {
      roomCode: code,
      playerId: observerId,
      name: 'Spectator',
    });
    await addObserver;
    await joinRoom(s1, { roomCode: code, playerId: p1, name: 'Alpha' });

    const room = roomManager.get(code);
    expect(room).toBeDefined();
    const player = room?.getPlayer(p1);
    expect(player).toBeDefined();
    if (!player) throw new Error('player not found');
    player.isEliminated = true;
    player.lives = 0;

    setDisconnectGrace(50);

    const waitForDisconnectMessage = new Promise<void>((resolve, reject) => {
      const onceHandler = (msg: ChatMessagePayload) => {
        if (
          msg.roomCode === code &&
          msg.type === 'system' &&
          msg.message === 'Alpha disconnected.'
        ) {
          clearTimeout(timeout);
          observer.off('chatMessage', onceHandler);
          resolve();
        }
      };
      const timeout = setTimeout(() => {
        observer.off('chatMessage', onceHandler);
        reject(new Error('Timed out waiting for disconnect message'));
      }, 700);
      observer.on('chatMessage', onceHandler);
    });

    try {
      s1.disconnect();

      await waitForDisconnectMessage;
      await new Promise((resolve) => {
        setTimeout(resolve, 200);
      });

      const alphaMessages = chatHistory.filter(
        (msg) => msg.type === 'system' && msg.message.includes('Alpha'),
      );
      expect(
        alphaMessages.some((msg) => msg.message === 'Alpha disconnected.'),
      ).toBe(true);
      expect(
        alphaMessages.some((msg) => msg.message.includes('will be removed')),
      ).toBe(false);
      expect(
        alphaMessages.some((msg) => msg.message.includes('was eliminated')),
      ).toBe(false);
    } finally {
      setDisconnectGrace(10000);
      observer.off('chatMessage', historyHandler);
    }
  });

  it('eliminates disconnected player after grace while game is active', async () => {
    const ctx = useServer();
    const code = createRoomCode();
    ensureRoom(code);
    const s1 = ctx.createClient();
    const s2 = ctx.createClient();
    await Promise.all([waitForConnect(s1), waitForConnect(s2)]);
    const p1 = requireId(s1.id);
    const p2 = requireId(s2.id);
    await joinRoom(s1, { roomCode: code, playerId: p1, name: 'Alpha' });
    await joinRoom(s2, { roomCode: code, playerId: p2, name: 'Bravo' });
    await setSeated(s1, { roomCode: code, playerId: p1, seated: true });
    await setSeated(s2, { roomCode: code, playerId: p2, seated: true });

    const gameStarted = new Promise<void>((resolve) => {
      s2.once('gameStarted', () => resolve());
    });
    const turnStarted = new Promise<void>((resolve) => {
      s2.once('turnStarted', () => resolve());
    });

    setDisconnectGrace(50);

    try {
      const start = await startGame(s1, code);
      expect(start.success).toBe(true);
      await gameStarted;
      await turnStarted;

      const eliminated = new Promise<PlayerUpdatedPayload>(
        (resolve, reject) => {
          const timeout = setTimeout(() => {
            s2.off('playerUpdated', handler);
            reject(new Error('timeout waiting for player elimination'));
          }, 1500);
          const handler = (payload: PlayerUpdatedPayload) => {
            if (payload.playerId === p1 && payload.lives === 0) {
              clearTimeout(timeout);
              s2.off('playerUpdated', handler);
              resolve(payload);
            }
          };
          s2.on('playerUpdated', handler);
        },
      );

      const gameEnded = new Promise<GameEndedPayload>((resolve, reject) => {
        const timeout = setTimeout(() => {
          s2.off('gameEnded', endHandler);
          reject(new Error('timeout waiting for gameEnded'));
        }, 1500);
        const endHandler = (payload: GameEndedPayload) => {
          clearTimeout(timeout);
          s2.off('gameEnded', endHandler);
          resolve(payload);
        };
        s2.on('gameEnded', endHandler);
      });

      s1.disconnect();

      const [elim, ended] = await Promise.all([eliminated, gameEnded]);
      expect(elim.playerId).toBe(p1);
      expect(elim.lives).toBe(0);
      expect(ended.winnerId).toBe(p2);
    } finally {
      setDisconnectGrace(10000);
    }
  });

  it('explicit leave removes player (diff removed list)', async () => {
    const ctx = useServer();
    const code = createRoomCode();
    ensureRoom(code);
    const s1 = ctx.createClient();
    const s2 = ctx.createClient();
    await Promise.all([waitForConnect(s1), waitForConnect(s2)]);
    const p1 = requireId(s1.id);
    const p2 = requireId(s2.id);
    const diffs: PlayersDiffPayload[] = [];
    s2.on('playersDiff', (d) => {
      diffs.push(d);
    });
    const addSolo = waitForPlayersCount(s1, 1);
    await joinRoom(s1, { roomCode: code, playerId: p1, name: 'Solo' });
    await addSolo;
    // observer joins; await both full state count=2 and diff add event
    const addObsCount = waitForPlayersCount(s2, 2);
    const addObsDiff = waitForDiff(s2, (d: PlayersDiffPayload) => {
      const ok: boolean = d.added.some((a: { id: string }) => a.id === p2);
      return ok;
    });
    await joinRoom(s2, { roomCode: code, playerId: p2, name: 'Observer' });
    await Promise.all([addObsCount, addObsDiff]);
    const removalDiff = waitForDiff(s2, (d: PlayersDiffPayload) => {
      const ok: boolean = d.removed.includes(p1);
      return ok;
    });
    s1.emit('leaveRoom', { roomCode: code, playerId: p1 });
    await removalDiff;
    const removedIds = diffs.flatMap((d: PlayersDiffPayload) => {
      const arr: string[] = d.removed;
      return arr;
    });
    expect(removedIds.includes(p1)).toBe(true);
  });

  it('submitWord sends actionAck with clientActionId', async () => {
    const ctx = useServer();
    const code = createRoomCode();
    ensureRoom(code);
    const s1 = ctx.createClient();
    await waitForConnect(s1);
    const p1 = requireId(s1.id);
    const add = waitForPlayersCount(s1, 1);
    await joinRoom(s1, { roomCode: code, playerId: p1, name: 'A' });
    await add;
    const acks: ActionAckPayload[] = [];
    s1.on('actionAck', (ack) => {
      acks.push(ack);
    });
    const clientActionId = 'test-action-1';
    s1.emit('submitWord', {
      roomCode: code,
      playerId: p1,
      word: 'cat',
      clientActionId,
    });
    const ack = await waitForActionAck(s1, clientActionId);
    expect(ack.clientActionId).toBe(clientActionId);
  });

  it('rejects submitWord after game has ended and removes engine from registry', async () => {
    const ctx = useServer();
    const code = createRoomCode();
    ensureRoom(code);

    const s1 = ctx.createClient();
    const s2 = ctx.createClient();
    await Promise.all([waitForConnect(s1), waitForConnect(s2)]);

    const p1 = requireId(s1.id);
    const p2 = requireId(s2.id);

    const joinP1 = waitForPlayersCount(s1, 1);
    await joinRoom(s1, { roomCode: code, playerId: p1, name: 'Alpha' });
    await joinP1;
    const joinP2 = waitForPlayersCount(s1, 2);
    await joinRoom(s2, { roomCode: code, playerId: p2, name: 'Bravo' });
    await joinP2;

    await setSeated(s1, { roomCode: code, playerId: p1, seated: true });
    await setSeated(s2, { roomCode: code, playerId: p2, seated: true });

    const gameStarted = new Promise<void>((resolve) => {
      s1.once('gameStarted', () => {
        resolve();
      });
    });
    const turnStarted = new Promise<void>((resolve) => {
      s1.once('turnStarted', () => {
        resolve();
      });
    });
    const start = await startGame(s1, code);
    expect(start.success).toBe(true);
    await Promise.all([gameStarted, turnStarted]);

    const room = roomManager.get(code);
    if (!room?.game) {
      throw new Error('Expected room to have an active game');
    }
    const currentPlayer = room.game.getCurrentPlayer();
    const currentPlayerId = currentPlayer.id;
    const otherPlayers = room.game.players.filter(
      (pl) => pl.id !== currentPlayerId,
    );
    for (const opponent of otherPlayers) {
      opponent.isEliminated = true;
      opponent.lives = 0;
    }

    const finishAction = 'finish-game';
    const finishAck = waitForActionAck(s1, finishAction);
    const gameEnded = new Promise<void>((resolve) => {
      s1.once('gameEnded', () => {
        resolve();
      });
    });
    s1.emit('submitWord', {
      roomCode: code,
      playerId: currentPlayerId,
      word: 'aab',
      clientActionId: finishAction,
    });
    const finish = await finishAck;
    expect(finish.success).toBe(true);
    await gameEnded;

    // room is known to exist here; assert game cleared
    expect(room.game).toBeUndefined();
    expect(getGameEngine(code)).toBeUndefined();

    const retryAction = 'after-end';
    const retryAckPromise = waitForActionAck(s1, retryAction);
    s1.emit('submitWord', {
      roomCode: code,
      playerId: currentPlayerId,
      word: 'aab',
      clientActionId: retryAction,
    });
    const retryAck = await retryAckPromise;
    expect(retryAck.success).toBe(false);
    expect(retryAck.error).toBe('Game not running.');
  });

  // Extra coverage merged from roomHandlers.extra.test.ts
  it('handles a full happy path: startGame -> playerTyping (current + ignored other) -> submitWord success + failure', async () => {
    const ctx = useServer();
    const code = createRoomCode();
    // create room
    roomManager.create(code, {
      maxLives: 3,
      startingLives: 3,
      bonusTemplate: Array.from({ length: 26 }, () => 1),
      minTurnDuration: 1,
      minWordsPerPrompt: 1,
    });

    const s1 = ctx.createClient();
    const s2 = ctx.createClient();
    await Promise.all([
      new Promise<void>((r) => {
        s1.once('connect', () => {
          r();
        });
      }),
      new Promise<void>((r) => {
        s2.once('connect', () => {
          r();
        });
      }),
    ]);
    const p1 = requireId(s1.id);
    const p2 = requireId(s2.id);
    const addA = waitForPlayersCount(s1, 1);
    await joinRoom(s1, { roomCode: code, playerId: p1, name: 'A' });
    await addA;
    const addB = waitForPlayersCount(s1, 2);
    await joinRoom(s2, { roomCode: code, playerId: p2, name: 'B' });
    await addB;
    await setSeated(s1, { roomCode: code, playerId: p1, seated: true });
    await setSeated(s2, { roomCode: code, playerId: p2, seated: true });

    // Capture turn/player order via turnStarted
    let currentTurnPlayer: string | null = null;
    await new Promise<void>((resolve) => {
      s1.once('turnStarted', (payload) => {
        currentTurnPlayer = payload.playerId;
        resolve();
      });
      void startGame(s1, code);
    });

    expect(currentTurnPlayer).toBeTruthy();
    const current = currentTurnPlayer as unknown as string; // non-null after turnStarted event
    const other = current === p1 ? p2 : p1;

    const typingEvents: { playerId: string; input: string }[] = [];
    s1.on('playerTypingUpdate', (p) => typingEvents.push(p));

    // Non-current player typing should be ignored
    s1.emit('playerTyping', {
      roomCode: code,
      playerId: other,
      input: 'xxxx',
    });
    // Current player typing should broadcast
    s1.emit('playerTyping', {
      roomCode: code,
      playerId: current,
      input: 'a',
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(typingEvents.some((e) => e.playerId === currentTurnPlayer)).toBe(
      true,
    );
    expect(typingEvents.some((e) => e.playerId === other)).toBe(false);

    // submitWord success path (word contains fragment 'aa')
    const successAction = 'succ-1';
    s1.emit('submitWord', {
      roomCode: code,
      playerId: current,
      word: 'aab',
      clientActionId: successAction,
    });
    const successAck = await waitForActionAck(s1, successAction);
    expect(successAck.success).toBe(true);

    // submitWord failure path inside engine (fragment now likely changed, but choose invalid word missing 'aa')
    const failAction = 'fail-1';
    s1.emit('submitWord', {
      roomCode: code,
      playerId: current,
      word: 'zz', // will fail fragment inclusion rule (or future validation)
      clientActionId: failAction,
    });
    const failAck = await waitForActionAck(s1, failAction);
    expect(failAck.success).toBe(false);
  });

  it('allows the leader to update room rules and broadcasts changes', async () => {
    const ctx = useServer();
    const code = createRoomCode();
    ensureRoom(code);
    const leader = ctx.createClient();
    const guest = ctx.createClient();
    await Promise.all([waitForConnect(leader), waitForConnect(guest)]);
    const leaderId = requireId(leader.id);
    const guestId = requireId(guest.id);
    const leaderEvents: RoomRulesPayload[] = [];
    const guestEvents: RoomRulesPayload[] = [];
    leader.on('roomRulesUpdated', (payload) => leaderEvents.push(payload));
    guest.on('roomRulesUpdated', (payload) => guestEvents.push(payload));
    const leaderRules = new Promise<RoomRulesPayload>((resolve) => {
      leader.once('roomRulesUpdated', (p) => {
        resolve(p);
      });
    });
    await joinRoom(leader, {
      roomCode: code,
      playerId: leaderId,
      name: 'Leader',
    });
    await leaderRules; // ensure leader received rules snapshot
    const guestRules = new Promise<RoomRulesPayload>((resolve) => {
      guest.once('roomRulesUpdated', (p) => {
        resolve(p);
      });
    });
    await joinRoom(guest, { roomCode: code, playerId: guestId, name: 'Guest' });
    await guestRules; // ensure guest received rules snapshot

    const nextRules = {
      maxLives: 5,
      startingLives: 3,
      bonusTemplate: Array.from({ length: 26 }, (_, idx) =>
        idx % 3 === 0 ? 2 : 1,
      ),
      minTurnDuration: 4,
      minWordsPerPrompt: 300,
    } as RoomRulesPayload['rules'];

    const leaderNext = new Promise<RoomRulesPayload>((resolve) => {
      leader.once('roomRulesUpdated', (p) => {
        resolve(p);
      });
    });
    const guestNext = new Promise<RoomRulesPayload>((resolve) => {
      guest.once('roomRulesUpdated', (p) => {
        resolve(p);
      });
    });
    const res = await new Promise<BasicResponse>((resolve) => {
      leader.emit(
        'updateRoomRules',
        { roomCode: code, rules: nextRules },
        (r) => {
          resolve(r);
        },
      );
    });
    expect(res.success).toBe(true);
    const [leaderLatest, guestLatest] = await Promise.all([
      leaderNext,
      guestNext,
    ]);
    expect(leaderLatest.rules.maxLives).toBe(nextRules.maxLives);
    expect(guestLatest.rules.minTurnDuration).toBe(nextRules.minTurnDuration);
    expect(guestLatest.rules.bonusTemplate[0]).toBe(nextRules.bonusTemplate[0]);
  });

  it('rejects rule updates from non-leader sockets', async () => {
    const ctx = useServer();
    const code = createRoomCode();
    ensureRoom(code);
    const leader = ctx.createClient();
    const guest = ctx.createClient();
    await Promise.all([waitForConnect(leader), waitForConnect(guest)]);
    const leaderId = requireId(leader.id);
    const guestId = requireId(guest.id);
    const leaderRules2 = new Promise<RoomRulesPayload>((resolve) => {
      leader.once('roomRulesUpdated', (p) => {
        resolve(p);
      });
    });
    await joinRoom(leader, {
      roomCode: code,
      playerId: leaderId,
      name: 'Leader',
    });
    await leaderRules2;
    const guestRules2 = new Promise<RoomRulesPayload>((resolve) => {
      guest.once('roomRulesUpdated', (p) => {
        resolve(p);
      });
    });
    await joinRoom(guest, { roomCode: code, playerId: guestId, name: 'Guest' });
    await guestRules2;

    const invalidRules = {
      maxLives: 2,
      startingLives: 2,
      bonusTemplate: Array(26).fill(1),
      minTurnDuration: 3,
      minWordsPerPrompt: 200,
    } as RoomRulesPayload['rules'];

    const res = await new Promise<BasicResponse>((resolve) => {
      guest.emit(
        'updateRoomRules',
        { roomCode: code, rules: invalidRules },
        (r) => {
          resolve(r);
        },
      );
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/leader/i);
  });

  it('exercises invalid payload parsers for join/leave/seated/start/typing/submitWord', async () => {
    const ctx = useServer();
    const s = ctx.createClient();
    await new Promise<void>((r) => {
      s.once('connect', () => {
        r();
      });
    });

    // joinRoom invalid (non-object)
    await new Promise<void>((r) => {
      s.emit(
        'joinRoom',
        42 as unknown as never,
        (res: { success: boolean }) => {
          expect(res.success).toBe(false);
          r();
        },
      );
    });
    // joinRoom invalid (missing fields)
    await new Promise<void>((r) => {
      // @ts-expect-error intentional malformed payload
      s.emit('joinRoom', { roomCode: 1 }, (res: { success: boolean }) => {
        expect(res.success).toBe(false);
        r();
      });
    });

    // leaveRoom invalid (non-object) - no observable callback; just ensure no throw
    // intentionally invalid non-object payload to hit parser early return
    s.emit('leaveRoom', 123 as unknown as never);
    // @ts-expect-error intentional wrong types (roomCode not string) to hit parser guard
    s.emit('leaveRoom', { roomCode: 1 }); // malformed object

    // setPlayerSeated invalid
    await new Promise<void>((r) => {
      s.emit(
        'setPlayerSeated',
        { roomCode: 'AB', playerId: 9 as unknown as string, seated: true },
        (res: { success: boolean }) => {
          expect(res.success).toBe(false);
          r();
        },
      );
    });

    // startGame invalid payload
    await new Promise<void>((r) => {
      // @ts-expect-error invalid payload intentionally
      s.emit('startGame', { bad: true }, (res: { success: boolean }) => {
        expect(res.success).toBe(false);
        r();
      });
    });

    // playerTyping invalid payloads (no events should fire)
    const typing: { playerId: string; input: string }[] = [];
    s.on('playerTypingUpdate', (p) => typing.push(p));
    // invalid object missing required fields
    s.emit('playerTyping', { bad: true } as unknown as never);
    // invalid primitive
    s.emit('playerTyping', 5 as unknown as never);
    await new Promise((r) => setTimeout(r, 20));
    expect(typing.length).toBe(0);

    // submitWord invalid payload
    await new Promise<void>((r) => {
      s.emit(
        'submitWord',
        { roomCode: 'AAAA', playerId: 'x' } as unknown as never,
        (res: { success: boolean }) => {
          expect(res.success).toBe(false);
          r();
        },
      );
    });
  });
});
