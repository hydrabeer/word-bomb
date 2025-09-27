import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withServer } from './helpers';
import { roomManager } from '../src/room/roomManagerSingleton';
import type { TestContext } from './helpers';
import {
  loadDictionary,
  isValidWord,
  getRandomFragment,
} from '../src/dictionary';
import { setDisconnectGrace } from '../src/socket/roomHandlers';
import { GameRoom } from '@game/domain/rooms/GameRoom';
import { GameRoomRules } from '@game/domain/rooms/GameRoomRules';
import { GameEngine } from '../src/game/GameEngine';
import { createNewGame } from '../src/game/orchestration/createNewGame';

const useServer: () => TestContext = withServer();

function requireId(id: string | undefined): string {
  if (!id) throw new Error('id');
  return id;
}

describe('coverage extras', () => {
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

    function makeRoomWithGame() {
      const room = new GameRoom({ code: 'TEST' }, rules);
      // Add players (room.addPlayer sets leader then second)
      room.addPlayer({ id: 'P1', name: 'Alice' });
      room.addPlayer({ id: 'P2', name: 'Bob' });
      room.setPlayerSeated('P1', true);
      room.setPlayerSeated('P2', true);
      const game = createNewGame(room);
      if (!game) throw new Error('Game not created');
      return { room, game };
    }

    it('handles submitWord failure paths', () => {
      const emits: { event: string; payload: unknown }[] = [];
      const { game } = makeRoomWithGame();
      type EmitTest = (event: string, payload?: unknown) => void;
      const engine = new GameEngine({
        game,
        emit: ((e: unknown, payload: unknown) => {
          emits.push({ event: e as string, payload });
        }) as EmitTest,
        scheduler: {
          schedule: (d, cb) => setTimeout(cb, d),
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
      // Mock isValidWord to always true
      vi.mock('../src/dictionary', async () => {
        const mod =
          await vi.importActual<typeof import('../src/dictionary')>(
            '../src/dictionary',
          );
        return {
          ...mod,
          isValidWord: () => true,
          getRandomFragment: () => 'aa',
        };
      });
      // Re-import engine after mock (local file referencing above path) - but engine already imported.
      const emits: string[] = [];
      const { game } = makeRoomWithGame();
      type EmitTest = (event: string, payload?: unknown) => void;
      const engine = new GameEngine({
        game,
        emit: ((e: unknown) => {
          emits.push(e as string);
        }) as EmitTest,
        scheduler: {
          schedule: (d, cb) => setTimeout(cb, d),
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
      let response: { success: boolean; error?: string } | undefined; // invalid room
      s.emit(
        'joinRoom',
        { roomCode: 'NOPE', playerId: requireId(s.id), name: 'A' },
        (r: { success: boolean; error?: string }) => {
          response = r;
        },
      );
      await new Promise((r) => setTimeout(r, 20));
      expect(response?.success).toBe(false);
      // create room then invalid name (>20 chars)
      roomManager.create('ZZZZ', {
        maxLives: 3,
        startingLives: 3,
        bonusTemplate: new Array(26).fill(1),
        minTurnDuration: 1,
        minWordsPerPrompt: 1,
      });
      s.emit(
        'joinRoom',
        { roomCode: 'ZZZZ', playerId: requireId(s.id), name: 'x'.repeat(25) },
        (r: { success: boolean; error?: string }) => {
          response = r;
        },
      );
      await new Promise((r) => setTimeout(r, 20));
      expect(response?.success).toBe(false);
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
      observer.emit('joinRoom', {
        roomCode: 'TIME',
        playerId: requireId(observer.id),
        name: 'Obs',
      });
      observer.on('playersDiff', (d) => diffs.push(d));
      pSock.emit('joinRoom', {
        roomCode: 'TIME',
        playerId: pSockId,
        name: 'GoneSoon',
      });
      await new Promise((r) => setTimeout(r, 30));
      pSock.disconnect(); // mark disconnected
      await new Promise((r) => setTimeout(r, 120)); // wait past 50ms grace
      // Expect a diff with removed id, but if diff missed due to timing, assert room state
      const removedIds = diffs.flatMap((d) => d.removed);
      if (!removedIds.includes(pSockId)) {
        const room = roomManager.get('TIME');
        expect(room?.hasPlayer(pSockId)).toBe(false);
      } else {
        expect(removedIds).toContain(pSockId);
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
      s.emit('joinRoom', {
        roomCode: 'AAAA',
        playerId: requireId(s.id),
        name: 'Mover',
      });
      await new Promise((r) => setTimeout(r, 20));
      s.emit('joinRoom', {
        roomCode: 'BBBB',
        playerId: requireId(s.id),
        name: 'Mover',
      });
      await new Promise((r) => setTimeout(r, 20));
      // ensure still success path (implicit by lack of error) and manager holds both rooms
      expect(roomManager.get('AAAA')?.hasPlayer(requireId(s.id))).toBe(false); // left first
      expect(roomManager.get('BBBB')?.hasPlayer(requireId(s.id))).toBe(true);
    });
  });
});
