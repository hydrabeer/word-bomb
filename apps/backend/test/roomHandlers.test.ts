import { describe, it, expect, beforeEach } from 'vitest';
import { withServer } from './helpers';
import { roomManager } from '../src/room/roomManagerSingleton';
import type { TestContext } from './helpers';

import type { PlayersUpdatedPayload, PlayersDiffPayload, ActionAckPayload } from '@game/domain/socket/types';

const useServer: () => TestContext = withServer();

// helpers
import { joinRoom, waitForConnect, setPlayerSeated as setSeated, startGame, ensureRoom, requireId, createRoomCode, waitForPlayersCount, waitForDiff, waitForActionAck } from './testUtils';

// Removed duplicate function definitions and unused types

describe('roomHandlers integration', () => {
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
    const first = await joinRoom(sock, { roomCode: code, playerId, name: 'Alice' });
    const payload = await firstJoinWait;
    // Second join (idempotent reconnection path) - set listener before emitting
    const secondJoinWait = waitForPlayersCount(sock, 1);
    const second = await joinRoom(sock, { roomCode: code, playerId, name: 'Alice' });
    await secondJoinWait; // expect another emission but still 1 player
  const ids = payload.players.map(p => p.id);
  expect(new Set(ids).size).toBe(1);
    expect(first.success).toBe(true);
    expect(second.success).toBe(true); // no error on duplicate join (server just ignores)
  });

  it('broadcasts playersUpdated with 2 players', async () => {
    const ctx = useServer();
  const code = createRoomCode(); ensureRoom(code);
    const s1 = ctx.createClient();
    const s2 = ctx.createClient();
    await Promise.all([waitForConnect(s1), waitForConnect(s2)]);
  const p1 = requireId(s1.id); const p2 = requireId(s2.id);
    const updates: PlayersUpdatedPayload[] = [];
    s1.on('playersUpdated', (p) => { updates.push(p); });
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
  const code = createRoomCode(); ensureRoom(code);
    const s1 = ctx.createClient();
    const s2 = ctx.createClient();
    await Promise.all([waitForConnect(s1), waitForConnect(s2)]);
  const p1 = requireId(s1.id); const p2 = requireId(s2.id);
    let countdownStarted = 0; let countdownStopped = 0;
    s1.on('gameCountdownStarted', () => { countdownStarted += 1; });
    s1.on('gameCountdownStopped', () => { countdownStopped += 1; });
  const joinA = waitForPlayersCount(s1, 1);
  await joinRoom(s1, { roomCode: code, playerId: p1, name: 'A' });
  await joinA;
  const joinB = waitForPlayersCount(s1, 2);
  await joinRoom(s2, { roomCode: code, playerId: p2, name: 'B' });
  await joinB;
  await setSeated(s1, { roomCode: code, playerId: p1, seated: true });
  const countdownPromise = new Promise<void>((resolve) => { s1.once('gameCountdownStarted', () => { resolve(); }); });
  await setSeated(s2, { roomCode: code, playerId: p2, seated: true });
  await countdownPromise;
    expect(countdownStarted).toBe(1);
  const stopPromise = new Promise<void>((resolve) => { s1.once('gameCountdownStopped', () => { resolve(); }); });
  await setSeated(s2, { roomCode: code, playerId: p2, seated: false });
  await stopPromise;
    expect(countdownStopped).toBe(1);
  });

  it('prevents game start with < 2 seated players', async () => {
    const ctx = useServer();
  const code = createRoomCode(); ensureRoom(code);
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
  const code = createRoomCode(); ensureRoom(code);
    const s1 = ctx.createClient();
    const s2 = ctx.createClient();
    await Promise.all([waitForConnect(s1), waitForConnect(s2)]);
  const p1 = requireId(s1.id); const p2 = requireId(s2.id);
  const addA = waitForPlayersCount(s1, 1); await joinRoom(s1, { roomCode: code, playerId: p1, name: 'A' }); await addA;
  const addB = waitForPlayersCount(s1, 2); await joinRoom(s2, { roomCode: code, playerId: p2, name: 'B' }); await addB;
  await setSeated(s1, { roomCode: code, playerId: p1, seated: true });
  await setSeated(s2, { roomCode: code, playerId: p2, seated: true });
  const res = await startGame(s1, code);
    expect(res.success).toBe(true);
  });

  it('marks player disconnected then reconnected (diff events)', async () => {
    const ctx = useServer();
  const code = createRoomCode(); ensureRoom(code);
  const observer = ctx.createClient();
  const s1 = ctx.createClient();
  await Promise.all([waitForConnect(observer), waitForConnect(s1)]);
  const pObserver = requireId(observer.id);
  const p1 = requireId(s1.id);
  const diffEvents: PlayersDiffPayload[] = [];
  observer.on('playersDiff', (d) => { diffEvents.push(d); });
  const addObserver = waitForPlayersCount(observer, 1); await joinRoom(observer, { roomCode: code, playerId: pObserver, name: 'Obs' }); await addObserver;
  const diffAddPromise = waitForDiff(observer, d => d.added.some(a => a.id === p1));
  await joinRoom(s1, { roomCode: code, playerId: p1, name: 'Alpha' });
  await diffAddPromise;
  const disconnectDiff = waitForDiff(observer, d => d.updated.some(u => u.id === p1 && u.changes.isConnected === false));
  s1.disconnect();
  await disconnectDiff;
  const s1b = ctx.createClient();
  await waitForConnect(s1b);
  const reconnectDiff = waitForDiff(observer, d => d.updated.some(u => u.id === p1 && u.changes.isConnected === true));
  await joinRoom(s1b, { roomCode: code, playerId: p1, name: 'Alpha' });
  await reconnectDiff;
    const flattenedUpdates = diffEvents.flatMap(e => e.updated);
    const hasDisconnect = flattenedUpdates.some(u => u.changes.isConnected === false);
    const hasReconnect = flattenedUpdates.some(u => u.changes.isConnected === true);
    expect(hasDisconnect || hasReconnect).toBe(true); // at least one connectivity change observed
    expect(hasReconnect).toBe(true);
  });

  it('explicit leave removes player (diff removed list)', async () => {
    const ctx = useServer();
  const code = createRoomCode(); ensureRoom(code);
  const s1 = ctx.createClient();
  const s2 = ctx.createClient();
  await Promise.all([waitForConnect(s1), waitForConnect(s2)]);
  const p1 = requireId(s1.id);
  const p2 = requireId(s2.id);
  const diffs: PlayersDiffPayload[] = [];
  s2.on('playersDiff', (d) => { diffs.push(d); });
      const addSolo = waitForPlayersCount(s1, 1); await joinRoom(s1, { roomCode: code, playerId: p1, name: 'Solo' }); await addSolo;
  // observer joins; await both full state count=2 and diff add event
  const addObsCount = waitForPlayersCount(s2, 2);
  const addObsDiff = waitForDiff(s2, d => d.added.some(a => a.id === p2));
  await joinRoom(s2, { roomCode: code, playerId: p2, name: 'Observer' });
  await Promise.all([addObsCount, addObsDiff]);
  const removalDiff = waitForDiff(s2, d => d.removed.includes(p1));
  s1.emit('leaveRoom', { roomCode: code, playerId: p1 });
  await removalDiff;
    const removedIds = diffs.flatMap(d => d.removed);
    expect(removedIds.includes(p1)).toBe(true);
  });

  it('submitWord sends actionAck with clientActionId', async () => {
    const ctx = useServer();
  const code = createRoomCode(); ensureRoom(code);
    const s1 = ctx.createClient();
    await waitForConnect(s1);
    const p1 = requireId(s1.id);
  const add = waitForPlayersCount(s1, 1); await joinRoom(s1, { roomCode: code, playerId: p1, name: 'A' }); await add;
    const acks: ActionAckPayload[] = [];
    s1.on('actionAck', (ack) => { acks.push(ack); });
    const clientActionId = 'test-action-1';
  s1.emit('submitWord', { roomCode: code, playerId: p1, word: 'cat', clientActionId });
  const ack = await waitForActionAck(s1, clientActionId);
  expect(ack.clientActionId).toBe(clientActionId);
  });
});
