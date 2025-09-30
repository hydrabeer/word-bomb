# Word Bomb

[![codecov](https://codecov.io/gh/hydrabeer/word-bomb/graph/badge.svg?token=CZU4XTPVQK)](https://codecov.io/gh/hydrabeer/word-bomb)

## TL;DR Quick Start (Local Dev)

### Prereqs

- Install Node from [nodejs.org](https://nodejs.org/)

```bash
git clone https://github.com/hydrabeer/word-bomb.git
cd word-bomb

# Make sure you have node installed
node -v

# Lets you use pnpm, our package manager
corepack enable

# Install all the dependencies
pnpm install --frozen-lockfile

# Start the backend and frontend dev servers
pnpm dev
```

When you start the dev server, it'll give you a link to the frontend, `http://localhost:5173` by default. The frontend will talk to the backend on `http://localhost:3001` unless configured otherwise with environment variables.

### Dictionary setup

To actually play in dev, you'll need to download a word list and put it at `apps/backend/src/dictionary/words.txt`.

---

## Monorepo Map

```
apps/
  backend/     # Express + Socket.IO server, room orchestration, logging
  frontend/    # React UI, routes, components, hooks
packages/
  domain/      # Pure game/domain logic for the backend
  types/       # Shared TypeScript types (socket payloads, events)
  typescript-config/  # Shared tsconfig presets

docs/          # Read some!
```

Design intent: **business rules live in `packages/domain`**, imported by both backend and tests. Backend focuses on orchestration (rooms, timers, sockets). Frontend focuses on the player UI/UX with a mobile‑first mindset.

---

## Scripts & Tasks (no magic, just pnpm)

Common one‑liners, from repo root:

```bash
# Install deps
pnpm install --frozen-lockfile

# Typecheck only (no emit)
pnpm typecheck

# Lint (TypeScript)
pnpm lint

# Format files
pnpm format

# Run all tests with coverage (workspace configs)
pnpm test:coverage

# -F is short for --filter, useful for focusing
pnpm -F backend test:coverage
pnpm -F frontend test:coverage
pnpm -F @word-bomb/domain test:coverage
pnpm -F @word-bomb/types test:coverage
```

Coverage goal is **100%** – iterate until green.

---

## Development Notes

- **Domain‑first**: put new game rules and computations in `packages/domain` with exhaustive tests; import into backend/frontend.
- **Typed sockets**: shared event names and payloads live in `packages/types`. Add/modify there first, then wire in backend/ frontend.
- **Mobile UX**: ensure keyboard‑safe layouts and readable timers; test on small viewports early.
- **Logging**: backend logging utilities live under `apps/backend/src/logging`. Use structured logs; do not commit code with `console.log` in it.

---

## Testing

The repo uses **Vitest** everywhere.

**Patterns**

- Unit tests colocated with sources or under `src/**` next to the module.
- Integration tests live under `apps/**/test` where appropriate.
- Prefer **pure tests** in `packages/domain` and keep I/O out.

**Useful flags**

```bash
# Watch mode while developing a specific area
pnpm -F frontend test:watch src/components/GameBoard.test.tsx

# Debug a single test name
pnpm -F backend test -t "startGameForRoom emits events in order"
```

---

## CI expectations (high level)

- PRs must pass: **typecheck, lint, tests + coverage**.
- **Conventional Commits** required (scopes like `frontend|backend|domain|types|infra|docs`).
- Keep a single `CHANGELOG.md` updated for user‑visible changes.
- If you introduce/alter a protocol or major design choice, add an **ADR** in `docs/adr/`.

---

## Docs Standard

This repo adopts:

- **Diátaxis** structure (`/docs/{tutorials,how-to,reference,explanations}`) as it grows.
- **Keep a Changelog** + **Semantic Versioning**.
- **Conventional Commits**.
- **ADRs** (MADR format) for architectural decisions.

---

## Contributing

1. Fork & branch: `feat/<scope>-<short-description>`
2. Implement with tests; keep domain logic in `packages/domain` where possible.
3. Lint/format/typecheck locally.
4. Update `CHANGELOG.md` if user‑visible.
5. Open PR with checklist; link any ADR changes.

`CONTRIBUTING.md` codifies versions, scripts, and the PR checklist.

---

## License

This project is currently **UNLICENSED** (proprietary). Do not distribute without permission.
