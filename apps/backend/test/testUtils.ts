import type { Socket } from 'socket.io-client';
import type {
  BasicResponse,
  ClientToServerEvents,
  ServerToClientEvents,
  PlayersUpdatedPayload,
  PlayersDiffPayload,
  ActionAckPayload,
} from '@word-bomb/types';
import { roomManager } from '../src/room/roomManagerSingleton';

export type TestSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function requireId(id: string | undefined): string {
  if (typeof id === 'string') return id;
  throw new Error('Socket id not set');
}

export function waitForConnect(socket: TestSocket): Promise<void> {
  if (socket.connected) return Promise.resolve();
  return new Promise((resolve) => {
    socket.once('connect', () => {
      resolve();
    });
  });
}

export async function connectClients(...sockets: TestSocket[]): Promise<void> {
  await Promise.all(sockets.map(waitForConnect));
}

export function joinRoom(
  socket: TestSocket,
  payload: { roomCode: string; playerId: string; name: string },
): Promise<BasicResponse> {
  return new Promise<BasicResponse>((resolve) => {
    socket.emit('joinRoom', payload, (res?: BasicResponse) => {
      resolve(res ?? { success: false, error: 'No response' });
    });
  });
}

export function setPlayerSeated(
  socket: TestSocket,
  payload: { roomCode: string; playerId: string; seated: boolean },
): Promise<BasicResponse> {
  return new Promise<BasicResponse>((resolve) => {
    socket.emit('setPlayerSeated', payload, (res?: BasicResponse) => {
      resolve(res ?? { success: false, error: 'No response' });
    });
  });
}

export function startGame(
  socket: TestSocket,
  roomCode: string,
): Promise<BasicResponse> {
  return new Promise<BasicResponse>((resolve) => {
    socket.emit('startGame', { roomCode }, (res?: BasicResponse) => {
      resolve(res ?? { success: false, error: 'No response' });
    });
  });
}

export function ensureRoom(code: string) {
  if (!roomManager.has(code)) {
    roomManager.create(code, {
      maxLives: 3,
      startingLives: 3,
      bonusTemplate: Array.from({ length: 26 }, () => 1),
      minTurnDuration: 5,
      minWordsPerPrompt: 1,
    });
  }
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Generate a pseudo random 4-letter uppercase room code
export function createRoomCode(): string {
  // Ensure exactly 4 A-Z letters to satisfy GameRoomSchema regex /[A-Z]{4}/
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++)
    code += letters[Math.floor(Math.random() * letters.length)];
  return code;
}

export async function waitForPlayersCount(
  socket: Socket,
  expected: number,
  timeoutMs = 600,
): Promise<PlayersUpdatedPayload> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off('playersUpdated', handler);
      reject(
        new Error(
          `Timed out waiting for playersUpdated length=${String(expected)}`,
        ),
      );
    }, timeoutMs);
    function handler(p: PlayersUpdatedPayload) {
      if (p.players.length === expected) {
        clearTimeout(timeout);
        socket.off('playersUpdated', handler);
        resolve(p);
      }
    }
    socket.on('playersUpdated', handler);
  });
}

export async function waitForDiff(
  socket: Socket,
  predicate: (d: PlayersDiffPayload) => boolean,
  timeoutMs = 700,
): Promise<PlayersDiffPayload> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off('playersDiff', handler);
      reject(new Error('Timed out waiting for playersDiff predicate'));
    }, timeoutMs);
    function handler(d: PlayersDiffPayload) {
      if (predicate(d)) {
        clearTimeout(timeout);
        socket.off('playersDiff', handler);
        resolve(d);
      }
    }
    socket.on('playersDiff', handler);
  });
}

export async function waitForActionAck(
  socket: Socket,
  clientActionId: string,
  timeoutMs = 600,
): Promise<ActionAckPayload> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off('actionAck', handler);
      reject(new Error(`Timed out waiting for actionAck ${clientActionId}`));
    }, timeoutMs);
    function handler(a: ActionAckPayload) {
      if (a.clientActionId === clientActionId) {
        clearTimeout(timeout);
        socket.off('actionAck', handler);
        resolve(a);
      }
    }
    socket.on('actionAck', handler);
  });
}

export async function createSeatedPair(
  ctx: { createClient: () => TestSocket },
  roomCode: string,
) {
  ensureRoom(roomCode);
  const a = ctx.createClient();
  const b = ctx.createClient();
  await connectClients(a, b);
  const idA = requireId(a.id);
  const idB = requireId(b.id);
  await joinRoom(a, { roomCode, playerId: idA, name: 'A' });
  await joinRoom(b, { roomCode, playerId: idB, name: 'B' });
  await setPlayerSeated(a, { roomCode, playerId: idA, seated: true });
  await setPlayerSeated(b, { roomCode, playerId: idB, seated: true });
  return { a, b, idA, idB };
}

export async function disconnectAndReconnect(
  ctx: { createClient: () => TestSocket },
  original: TestSocket,
  roomCode: string,
  playerId: string,
  name = 'Player',
): Promise<TestSocket> {
  original.disconnect();
  const re = ctx.createClient();
  await waitForConnect(re);
  await joinRoom(re, { roomCode, playerId, name });
  return re;
}

// Extra small helpers to reduce arbitrary sleeps in tests
import type { RoomRulesPayload } from '@word-bomb/types';

export async function waitForRoomRulesUpdated(
  socket: TestSocket,
  timeoutMs = 600,
): Promise<RoomRulesPayload> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off('roomRulesUpdated', handler);
      reject(new Error('Timed out waiting for roomRulesUpdated'));
    }, timeoutMs);
    function handler(p: RoomRulesPayload) {
      clearTimeout(timeout);
      socket.off('roomRulesUpdated', handler);
      resolve(p);
    }
    socket.on('roomRulesUpdated', handler);
  });
}
