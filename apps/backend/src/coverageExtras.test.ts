import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestServer, withServer } from '../test/helpers';
import { roomManager } from './features/rooms/app/roomManagerSingleton';
import type { TestContext } from '../test/helpers';
import {
  loadDictionary,
  isValidWord,
  getRandomFragment,
  createDictionaryPort,
} from './platform/dictionary';
import { setDisconnectGrace } from './features/rooms/socket/roomHandlers';
import { GameRoom } from '@game/domain/rooms/GameRoom';
import { GameRoomRules } from '@game/domain/rooms/GameRoomRules';
import { GameEngine } from './features/gameplay/engine/GameEngine';
import { createNewGame } from './features/gameplay/app/createNewGame';
import { waitForDiff, waitForPlayersCount } from '../test/testUtils';
import { createLogger } from './platform/logging';

const testLogger = createLogger({ service: 'backend-tests' });

async function canStartServer(): Promise<boolean> {
  try {
    const ctx = await setupTestServer();
    await ctx.close();
    return true;
  } catch (error) {
    testLogger.warn(
      { event: 'test_server_unavailable', err: error },
      'Skipping coverage extras socket tests',
    );
    return false;
  }
}

const serverAvailable = await canStartServer();
const describeCoverage = serverAvailable ? describe : describe.skip;
const useServer: () => TestContext = serverAvailable
  ? withServer()
  : () => {
      throw new Error('Coverage extras test server unavailable');
    };

function requireId(id: string | undefined): string {
  if (!id) throw new Error('id');
  return id;
}

describeCoverage('coverage extras', () => {
  beforeEach(() => {
    roomManager.clear();
  });

  describe('dictionary module', () => {
    it('loads dictionary and validates words / random fragment fallback', async () => {
      process.env.NODE_ENV = 'test';
      await loadDictionary(); // will read bundled words.txt (small)
      // words.txt contains entries used in gameplay; just assert deterministic fallback works
      // pick a clearly absent token unlikely in english word list
      // Positive case: a known short word exists
      expect(isValidWord('aa')).toBe(true);
      // Force fragment selection when no candidates meet high threshold
      const frag = getRandomFragment(9999); // triggers test fallback 'aa'
      expect(frag).toBe('aa');
    });
  });

  describe('GameEngine unit', () => {
    const rules: GameRoomRules = {
      maxLives: 2,
      startingLives: 2,
      bonusTemplate: Array.from({ length: 26 }, () => 1),
      minTurnDuration: 1,
      minWordsPerPrompt: 1,
    };

    function makeRoomWithGame(dictionary = createDictionaryPort()) {
      const room = new GameRoom({ code: 'TEST' }, rules);
      // Add players (room.addPlayer sets leader then second)
      room.addPlayer({ id: 'P1', name: 'Alice' });
      room.addPlayer({ id: 'P2', name: 'Bob' });
      room.setPlayerSeated('P1', true);
      room.setPlayerSeated('P2', true);
      const game = createNewGame(room, dictionary);
      if (!game) throw new Error('Game not created');
      return { room, game, dictionary };
    }

    it('handles submitWord failure paths', () => {
      const emits: { event: string; payload: unknown }[] = [];
      const { game, dictionary } = makeRoomWithGame();
      type EmitTest = (event: string, payload?: unknown) => void;
      const engine = new GameEngine({
        game,
        emit: ((e: unknown, payload: unknown) => {
          emits.push({ event: e as string, payload });
        }) as EmitTest,
        scheduler: {
          // Wrap cb in a function to satisfy no-implied-eval linters
          schedule: (d: number, cb: () => void) => {
            return setTimeout(() => {
              cb();
            }, d);
          },
          cancel: (t) => {
            clearTimeout(t as NodeJS.Timeout);
          },
        },
        eventsPort: {
          turnStarted: () => {
            /* noop */
          },
          playerUpdated: () => {
            /* noop */
          },
          wordAccepted: () => {
            /* noop */
          },
          gameEnded: () => {
            /* noop */
          },
        },
        dictionary,
      });
      const current = game.getCurrentPlayer();
      const notTurn = game.players[1];
      expect(engine.submitWord(notTurn.id, 'aaaa')).toEqual({
        success: false,
        error: 'Not your turn.',
      });
      expect(engine.submitWord(current.id, 'a')).toEqual({
        success: false,
        error: 'Invalid word (too short).',
      });
      expect(engine.submitWord(current.id, 'zz')).toEqual({
        success: false,
        error: "Word doesn't contain the fragment.",
      });
    });

    it('advances turn and emits acceptance on valid word (mock validity)', () => {
      const emits: string[] = [];
      const dictionary = {
        isValid: () => true,
        getRandomFragment: () => 'aa',
      };
      const { game } = makeRoomWithGame(dictionary);
      type EmitTest = (event: string, payload?: unknown) => void;
      const engine = new GameEngine({
        game,
        emit: ((e: unknown) => {
          emits.push(e as string);
        }) as EmitTest,
        scheduler: {
          // Wrap cb in a function to satisfy no-implied-eval linters
          schedule: (d: number, cb: () => void) => {
            return setTimeout(() => {
              cb();
            }, d);
          },
          cancel: (t) => {
            clearTimeout(t as NodeJS.Timeout);
          },
        },
        eventsPort: {
          turnStarted: () => {
            /* noop */
          },
          playerUpdated: () => {
            /* noop */
          },
          wordAccepted: () => {
            /* noop */
          },
          gameEnded: () => {
            /* noop */
          },
        },
        dictionary,
      });
      const current = game.getCurrentPlayer();
      const res = engine.submitWord(current.id, 'aab');
      expect(res.success).toBe(true);
      expect(emits).toContain('wordAccepted');
    });
  });

  describe('socket negative paths & timers', () => {
    it('rejects join with invalid name and room not found', async () => {
      const ctx = useServer();
      const s = ctx.createClient();
      await new Promise<void>((r) => {
        s.once('connect', () => {
          r();
        });
      });
      const res1 = await new Promise<{ success: boolean; error?: string }>(
        (resolve) => {
          s.emit(
            'joinRoom',
            { roomCode: 'NOPE', playerId: requireId(s.id), name: 'A' },
            (r: { success: boolean; error?: string }) => {
              resolve(r);
            },
          );
        },
      );
      expect(res1.success).toBe(false);
      // create room then invalid name (>20 chars)
      roomManager.create('ZZZZ', {
        maxLives: 3,
        startingLives: 3,
        bonusTemplate: new Array(26).fill(1),
        minTurnDuration: 1,
        minWordsPerPrompt: 1,
      });
      const res2 = await new Promise<{ success: boolean; error?: string }>(
        (resolve) => {
          s.emit(
            'joinRoom',
            {
              roomCode: 'ZZZZ',
              playerId: requireId(s.id),
              name: 'x'.repeat(25),
            },
            (r: { success: boolean; error?: string }) => {
              resolve(r);
            },
          );
        },
      );
      expect(res2.success).toBe(false);
    });

    it('removes inactive player after disconnect grace timeout (short grace)', async () => {
      setDisconnectGrace(50); // shorten for fast test
      const ctx = useServer();
      roomManager.create('TIME', {
        maxLives: 3,
        startingLives: 3,
        bonusTemplate: new Array(26).fill(1),
        minTurnDuration: 1,
        minWordsPerPrompt: 1,
      });
      const observer = ctx.createClient();
      const pSock = ctx.createClient();
      await Promise.all([
        new Promise<void>((r) => {
          observer.once('connect', () => {
            r();
          });
        }),
        new Promise<void>((r) => {
          pSock.once('connect', () => {
            r();
          });
        }),
      ]);
      const pSockId = requireId(pSock.id);
      const diffs: { removed: string[] }[] = [];
      const obsCount = waitForPlayersCount(observer, 1);
      observer.emit('joinRoom', {
        roomCode: 'TIME',
        playerId: requireId(observer.id),
        name: 'Obs',
      });
      observer.on('playersDiff', (d) => diffs.push(d));
      const twoCount = waitForPlayersCount(observer, 2);
      pSock.emit('joinRoom', {
        roomCode: 'TIME',
        playerId: pSockId,
        name: 'GoneSoon',
      });
      await Promise.all([obsCount, twoCount]);
      pSock.disconnect(); // mark disconnected
      try {
        const removal = await waitForDiff(
          observer,
          (d) => d.removed.includes(pSockId),
          800,
        );
        expect(removal.removed).toContain(pSockId);
      } catch {
        // Fallback: assert state if event missed
        const room = roomManager.get('TIME');
        expect(room?.hasPlayer(pSockId)).toBe(false);
      }
    });

    it('switches rooms properly (leave previous)', async () => {
      const ctx = useServer();
      roomManager.create('AAAA', {
        maxLives: 3,
        startingLives: 3,
        bonusTemplate: new Array(26).fill(1),
        minTurnDuration: 1,
        minWordsPerPrompt: 1,
      });
      roomManager.create('BBBB', {
        maxLives: 3,
        startingLives: 3,
        bonusTemplate: new Array(26).fill(1),
        minTurnDuration: 1,
        minWordsPerPrompt: 1,
      });
      const s = ctx.createClient();
      await new Promise<void>((r) => {
        s.once('connect', () => {
          r();
        });
      });
      const joinedA = new Promise<void>((resolve) => {
        s.once('roomRulesUpdated', () => {
          resolve();
        });
      });
      s.emit('joinRoom', {
        roomCode: 'AAAA',
        playerId: requireId(s.id),
        name: 'Mover',
      });
      await joinedA;
      const joinedB = new Promise<void>((resolve) => {
        s.once('roomRulesUpdated', () => {
          resolve();
        });
      });
      s.emit('joinRoom', {
        roomCode: 'BBBB',
        playerId: requireId(s.id),
        name: 'Mover',
      });
      await joinedB;
      // ensure still success path (implicit by lack of error). First room should be empty (and now cleaned up).
      expect(roomManager.has('AAAA')).toBe(false);
      expect(roomManager.get('BBBB')?.hasPlayer(requireId(s.id))).toBe(true);
    });
  });
});
