// apps/backend/src/routes/rooms.ts
import { Request, Response, Router } from 'express';
import { roomManager } from '../room/roomManagerSingleton';
import { getDictionaryStats, isUsingFallbackDictionary } from '../dictionary';
import type { GameRoomRules } from '@game/domain/rooms/GameRoomRules';
import {
  createRoomCodeGenerator,
  type RoomCodeGenerator,
} from './roomCodeGenerator';

const router: Router = Router();

let roomCodeGenerator: RoomCodeGenerator = createRoomCodeGenerator();

export function setRoomCodeGenerator(generator: RoomCodeGenerator): void {
  roomCodeGenerator = generator;
}

export function resetRoomCodeGenerator(): void {
  roomCodeGenerator = createRoomCodeGenerator();
}

class RoomCodeAllocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoomCodeAllocationError';
  }
}

// POST /api/rooms
export function createRoomHandler(req: Request, res: Response): void {
  try {
    // Optional name provided by client
    const body: Record<string, unknown> = (req.body ?? {}) as Record<
      string,
      unknown
    >;
    const nameRaw = typeof body.name === 'string' ? body.name : '';
    const name = nameRaw.trim().slice(0, 30);
    const rules = buildDefaultRoomRules();
    const code = createRoomWithUniqueCode(rules, name);

    res.status(201).json({ code });
  } catch (err) {
    if (err instanceof RoomCodeAllocationError) {
      res.status(503).json({ error: err.message });
      return;
    }
    res.status(400).json({ error: (err as Error).message });
  }
}

// GET /api/rooms/:code
export function getRoomHandler(req: Request, res: Response): void {
  const { code } = req.params;

  const room = roomManager.get(code);

  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  const name = typeof room.name === 'string' ? room.name.trim() : '';

  res.status(200).json({ exists: true, name });
}

router.post('/', createRoomHandler);
router.get('/:code', getRoomHandler);

export default router;

// Generate a room code (e.g. 4 uppercase letters)
function createRoomWithUniqueCode(rules: GameRoomRules, name: string): string {
  const MAX_ATTEMPTS = 100;
  let attempts = 0;

  while (attempts < MAX_ATTEMPTS) {
    const code = roomCodeGenerator();
    if (roomManager.has(code)) {
      attempts += 1;
      continue;
    }
    try {
      roomManager.create(code, rules, name);
      return code;
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('already exists')) {
        attempts += 1;
        continue;
      }
      throw err;
    }
  }

  throw new RoomCodeAllocationError(
    `Unable to allocate unique room code after ${MAX_ATTEMPTS.toString()} attempts`,
  );
}

function buildDefaultRoomRules(): GameRoomRules {
  const stats = getDictionaryStats();
  const fallback = isUsingFallbackDictionary();
  const dictionaryReady = stats.wordCount > 0 && stats.fragmentCount > 0;
  const minWordsPerPrompt = !fallback && dictionaryReady ? 500 : 1;

  return {
    maxLives: 3,
    startingLives: 3,
    bonusTemplate: Array.from({ length: 26 }, () => 1),
    minTurnDuration: 5,
    minWordsPerPrompt,
  };
}
