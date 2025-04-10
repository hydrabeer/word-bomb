// apps/backend/src/routes/rooms.ts
import { Request, Response, Router } from 'express';
import { roomManager } from '../room/roomManagerSingleton';

const router: Router = Router();

// POST /api/rooms
router.post('/', (_: Request, res: Response) => {
  try {
    const code = generateRoomCode();
    const rules = {
      maxLives: 3,
      bonusTemplate: Array(26).fill(1),
      minTurnDuration: 5,
    };

    roomManager.create(code, rules);

    res.status(201).json({ code });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// GET /api/rooms/:code
router.get('/:code', (req: Request, res: Response) => {
  const { code } = req.params;

  if (!roomManager.has(code)) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  res.status(200).json({ exists: true });
});

export default router;

// Generate a room code (e.g. 4 uppercase letters)
function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
