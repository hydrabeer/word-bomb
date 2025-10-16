# Backend (apps/backend)

Express 5 + Socket.IO server for Word Bomb. This package handles HTTP endpoints, room orchestration, and real‑time gameplay. Business rules live in `packages/domain`; socket event and payload types live in `packages/types`.

---

## Quick Start

> You can stay entirely in this folder after the initial install.

```bash
# One‑time setup from repo root
corepack enable
pnpm install --frozen-lockfile

# Dev server (in this folder)
cd apps/backend
pnpm dev   # starts http://localhost:3001 by default
```

Open another terminal for the frontend (optional for smoke tests):

```bash
# from repo root
pnpm dev:frontend  # usually serves http://localhost:5173
```

---

## Prerequisites

- **Node**: 22.x
- **pnpm** via Corepack

Check versions:

```bash
node -v
pnpm -v
```

---

## Environment

Create `.env` (or use actual environment variables). Example:

```ini
# apps/backend/.env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

---

## Dictionary (required for gameplay)

The backend needs a **local word list** for validation during gameplay.

Place a text file at:

```
apps/backend/src/platform/dictionary/words.txt
```

- One word per line.
- Keep encoding as UTF‑8.

> You can start the server without a dictionary to test health endpoints, but gameplay routes/events will require it.

---

## Scripts (package‑local)

From `apps/backend/`:

```json
{
  "dev": "ts-node -r tsconfig-paths/register src/index.ts",
  "start": "ts-node -r tsconfig-paths/register src/index.ts",
  "build": "tsc -b",
  "typecheck": "tsc -p tsconfig.json --noEmit",
  "lint": "eslint --cache --cache-location .eslintcache \"src/**/*.ts\"",
  "test": "vitest run --config vitest.config.ts",
  "test:watch": "vitest --watch --config vitest.config.ts",
  "test:coverage": "vitest run --config vitest.config.ts --coverage"
}
```

Common flows:

```bash
pnpm dev                 # start server
pnpm test:watch          # iterate on tests
pnpm test:coverage       # CI‑like coverage run
pnpm typecheck && pnpm lint
pnpm build               # emit to project references per tsconfig
```

> You can also run workspace‑scoped tasks from the repo root with `pnpm -F backend <script>`.

---

## Project Map (backend)

```
src/
  index.ts                      # app bootstrap, routes, socket server
  platform/
    logging/                    # pino logging helpers
    socket/                     # socket session, serialization, broadcaster
    dictionary/                 # dictionary loader + words.txt
  features/
    rooms/
      http/                     # Express routes (e.g., /rooms)
      socket/                   # Socket.IO event handlers + parsers
      app/                      # Room manager & app layer glue
    gameplay/
      app/                      # Orchestration: starting games, emitting players
      engine/                   # Game engine registry + types
  shared/utils/                 # helpers
```

- **Domain logic**: `packages/domain` (pure, tested). Import here; do not add game rules in the backend.
- **Shared types**: `packages/types` (socket events, payloads). Update here first when adding/changing events.

---

## Health & Readiness

These endpoints are available without any setup:

```bash
curl -i http://localhost:3001/healthz
curl -i http://localhost:3001/readyz
```

Expected: `200 OK` with a small JSON body (implementation‑specific). Use these for Docker/K8s liveness/readiness checks.

---

## HTTP Smoke Test (Rooms)

If rooms routes are enabled (`src/features/rooms/http/rooms.ts`):

```bash
# List rooms (example; exact routes may differ)
curl -s http://localhost:3001/rooms | jq .

# Create a room (if implemented with POST)
curl -s -X POST http://localhost:3001/rooms -H 'Content-Type: application/json' -d '{}' | jq .
```

If you see CORS errors in the browser, set `FRONTEND_URL` appropriately (defaults to `http://localhost:5173`).

---

## Socket.IO Smoke Test

Run a quick client in a Node REPL or file (requires `socket.io-client` dev dependency):

```js
// node -e "(async () => { /* paste code */ })()"
import { io } from 'socket.io-client';

const s = io('http://localhost:3001', { transports: ['websocket'] });
s.on('connect', () => {
  console.log('connected', s.id);
  // Try a room create/join if available
  s.emit('room:create', {}, (ack) => console.log('create:ack', ack));
});

s.on('disconnect', (r) => console.log('disconnect', r));
```

> Event names & payloads are defined in `packages/types`. Keep backend and frontend in sync by editing types there first.

---

## Logging

Backend uses **pino**. Utilities in `src/platform/logging/*` provide request context and structured logs. Avoid `console.log` in production paths; use the logger and include useful fields (`roomId`, `socketId`, `event`, etc.).

---

## Testing

We use **Vitest**. Layout:

- Unit tests colocated with sources: `src/**/*.test.ts`
- Integration tests under `apps/backend/test`

Helpful patterns:

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Focus by file or name
pnpm test -- -t "startGameForRoom emits events in order"

# Coverage report (HTML + summary)
pnpm test:coverage
```

Aim for high coverage; prefer pure tests in `packages/domain` for business rules.

---

## Adding Features (backend‑first workflow)

1. **Define types** in `packages/types` (events & payloads). Export minimal, stable surfaces.
2. **Implement domain logic** in `packages/domain` with exhaustive unit tests.
3. **Wire backend orchestration** here:
   - HTTP: add route handlers under `features/rooms/http/` (or a new feature folder).
   - Socket: extend parsers & handlers under `features/rooms/socket/` or `features/gameplay/app/`.
4. **Log meaningfully** via platform logging utilities.
5. **Add tests** (unit near code; integration under `apps/backend/test`).

---

## Troubleshooting

- **CORS error** in browser: check `FRONTEND_URL` and `cors` setup in `src/index.ts`.
- **Gameplay fails / words missing**: ensure `src/platform/dictionary/words.txt` exists and is readable; restart the server after adding it.

---

## Production Notes (brief)

- Expose `/healthz` and `/readyz` for liveness/readiness.
- Use `NODE_ENV=production` and a proper process manager (PM2, systemd, or container).
- Serve behind a reverse proxy/ingress with TLS and appropriate timeouts for websockets.

---

## References

- Frontend dev server default: `http://localhost:5173`
- Backend default: `http://localhost:3001`
- Types (events/payloads): `packages/types`
- Domain rules/engine: `packages/domain`

If anything here diverges from code, update this README in the same PR that changes behavior.

