import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withServer } from './helpers';
import { roomManager } from '../src/room/roomManagerSingleton';
import {
  joinRoom,
  setPlayerSeated,
  startGame,
  requireId,
  createRoomCode,
  waitForActionAck,
  sleep,
} from './testUtils';

// NOTE: We mock the dictionary BEFORE any game/engine modules are imported via server helpers
// so that GameEngine validation will always accept words and fragment is deterministic.
vi.mock('../src/dictionary', async () => {
  const actual =
    await vi.importActual<typeof import('../src/dictionary')>(
      '../src/dictionary',
    );
  return {
    ...actual,
    isValidWord: () => true,
    getRandomFragment: () => 'aa',
  };
});

const useServer = withServer();

describe('roomHandlers extra coverage', () => {
  beforeEach(() => {
    roomManager.clear();
  });

  it('handles a full happy path: startGame -> playerTyping (current + ignored other) -> submitWord success + failure', async () => {
    const ctx = useServer();
    const code = createRoomCode();
    // create room
    roomManager.create(code, {
      maxLives: 3,
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
    await joinRoom(s1, { roomCode: code, playerId: p1, name: 'A' });
    await sleep(30);
    await joinRoom(s2, { roomCode: code, playerId: p2, name: 'B' });
    await sleep(30);
    await setPlayerSeated(s1, { roomCode: code, playerId: p1, seated: true });
    await setPlayerSeated(s2, { roomCode: code, playerId: p2, seated: true });

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
    await new Promise((r) => setTimeout(r, 30));
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
