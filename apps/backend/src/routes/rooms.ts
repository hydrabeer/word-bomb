// apps/backend/src/routes/rooms.ts
import { Request, Response, Router } from 'express';
import { roomManager } from '../room/roomManagerSingleton';

const router: Router = Router();

// POST /api/rooms
export function createRoomHandler(req: Request, res: Response): void {
  try {
    const code = generateRoomCode();
    // Optional name provided by client
    const body: Record<string, unknown> = (req.body ?? {}) as Record<
      string,
      unknown
    >;
    const nameRaw = typeof body.name === 'string' ? body.name : '';
    const name = nameRaw.trim().slice(0, 30);
    const rules = {
      maxLives: 3,
      startingLives: 3,
      bonusTemplate: Array(26).fill(1),
      minTurnDuration: 5,
      minWordsPerPrompt: 500,
    };

    roomManager.create(code, rules, name);

    res.status(201).json({ code });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

// GET /api/rooms/:code
export function getRoomHandler(req: Request, res: Response): void {
  const { code } = req.params;

  if (!roomManager.has(code)) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  // We only need to confirm the room exists for this endpoint.
  // Avoid calling roomManager.get() here to keep the contract minimal
  // and to align with tests that expect only `{ exists: true }`.
  res.status(200).json({ exists: true });
}

router.post('/', createRoomHandler);
router.get('/:code', getRoomHandler);

export default router;

// Generate a room code (e.g. 4 uppercase letters)
function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Array.from(
    { length: 4 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join('');
}
