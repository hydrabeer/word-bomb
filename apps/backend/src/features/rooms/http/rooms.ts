// apps/backend/src/routes/rooms.ts
import { Request, Response, Router } from 'express';
import { roomManager } from '../app/roomManagerSingleton';
import {
  getDictionaryStats,
  isUsingFallbackDictionary,
} from '../../../platform/dictionary';
import type { GameRoomRules } from '@game/domain/rooms/GameRoomRules';
import type { GameRoomVisibility } from '@game/domain/rooms/GameRoom';
import {
  createRoomCodeGenerator,
  type RoomCodeGenerator,
} from './roomCodeGenerator';

const router: Router = Router();

let roomCodeGenerator: RoomCodeGenerator = createRoomCodeGenerator();

/**
 * Overrides the global room code generator, primarily for deterministic testing.
 *
 * @param generator Replacement room code generator.
 */
export function setRoomCodeGenerator(generator: RoomCodeGenerator): void {
  roomCodeGenerator = generator;
}

/**
 * Restores the default randomised room code generator implementation.
 */
export function resetRoomCodeGenerator(): void {
  roomCodeGenerator = createRoomCodeGenerator();
}

/**
 * Error indicating that the room code generator failed to yield a unique value in time.
 */
class RoomCodeAllocationError extends Error {
  /**
   * Creates a new allocation error with a descriptive message.
   *
   * @param message Explanation for why a room code could not be allocated.
   */
  constructor(message: string) {
    super(message);
    this.name = 'RoomCodeAllocationError';
  }
}

// POST /api/rooms
/**
 * Handles room creation requests issued via the REST API.
 *
 * Validates optional metadata, generates a unique room code, and persists
 * the resulting room in the shared {@link roomManager}.
 *
 * @param req Express request containing JSON body with optional `name`.
 * @param res Express response used to return the outcome.
 */
export function createRoomHandler(req: Request, res: Response): void {
  try {
    // Optional name provided by client
    const body: Record<string, unknown> = (req.body ?? {}) as Record<
      string,
      unknown
    >;
    const nameRaw = typeof body.name === 'string' ? body.name : '';
    const name = nameRaw.trim().slice(0, 30);
    const visibilityRaw =
      typeof body.visibility === 'string' ? body.visibility : '';
    const visibility = parseVisibility(visibilityRaw);
    const rules = buildDefaultRoomRules();
    const code = createRoomWithUniqueCode(rules, name, visibility);

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
/**
 * Retrieves metadata about a room, responding with `404` when absent.
 *
 * @param req Express request containing the room `code` parameter.
 * @param res Express response used to return the outcome.
 */
export function getRoomHandler(req: Request, res: Response): void {
  const { code } = req.params;

  const room = roomManager.get(code);

  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  const name = typeof room.name === 'string' ? room.name.trim() : '';

  res
    .status(200)
    .json({ exists: true, name, visibility: parseVisibility(room.visibility) });
}

/**
 * Returns rooms filtered by visibility; defaults to public listings when the query is absent.
 */
export function listRoomsHandler(req: Request, res: Response): void {
  const visibilityParam =
    typeof req.query.visibility === 'string' ? req.query.visibility : '';
  const visibility = parseVisibility(visibilityParam, 'public');
  const rooms = roomManager.listRoomsByVisibility(visibility).map((room) => ({
    code: room.code,
    name: typeof room.name === 'string' ? room.name.trim() : '',
    playerCount: room.getAllPlayers().length,
    visibility: room.visibility,
  }));
  res.status(200).json({ rooms });
}

router.post('/', createRoomHandler);
router.get('/', listRoomsHandler);
router.get('/:code', getRoomHandler);

export default router;

// Generate a room code (e.g. 4 uppercase letters)
/**
 * Ensures a unique room is created using the configured code generator.
 *
 * @param rules Default game rules applied to the new room.
 * @param name Optional room name supplied by the client.
 * @returns The unique room code assigned to the created room.
 * @throws {RoomCodeAllocationError} When a unique code cannot be reserved.
 */
function createRoomWithUniqueCode(
  rules: GameRoomRules,
  name: string,
  visibility: GameRoomVisibility,
): string {
  const MAX_ATTEMPTS = 100;
  let attempts = 0;

  while (attempts < MAX_ATTEMPTS) {
    const code = roomCodeGenerator();
    if (roomManager.has(code)) {
      attempts += 1;
      continue;
    }
    try {
      roomManager.create(code, rules, name, visibility);
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

/**
 * Produces the default game room rules payload supplied during creation.
 *
 * @returns Default {@link GameRoomRules} tuned for casual gameplay.
 */
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

function parseVisibility(
  raw: unknown,
  fallback: GameRoomVisibility = 'private',
): GameRoomVisibility {
  return raw === 'public' || raw === 'private' ? raw : fallback;
}
