# Contributing to Word Bomb

Thanks for helping build a delightful rip-off. This guide is the authoritative on‑ramp for local setup, coding standards, testing, commits, and PRs. It mirrors the README and codifies rules we enforce in CI.

---

## Prerequisites

- **Node**: 22.x
- **pnpm**: managed via Corepack

```bash
corepack enable
pnpm --version
```

Clone and install:
```bash
git clone https://github.com/hydrabeer/word-bomb.git
cd word-bomb
pnpm install --frozen-lockfile
```

---

## Workspace overview

```
apps/
  backend/   # Express + Socket.IO server, rooms, orchestration, logging
  frontend/  # React + Vite UI, routes, components, hooks
packages/
  domain/    # Pure game logic (no I/O)
  types/     # Shared TS types (events, payloads)
  typescript-config/
```

**Principle:** _Domain‑first_. Put rules and calculations in `packages/domain` with strong tests; import where needed.

---

## Running the project (dev)

Two terminals recommended.

```bash
# Terminal 1 – backend (default http://localhost:3001)
pnpm dev:backend

# Terminal 2 – frontend (default http://localhost:5173)
pnpm dev:frontend
```

Set the frontend’s backend URL via `VITE_BACKEND_URL` if you change ports.

### Dictionary (required for gameplay in dev)

Place a word list at:
```
apps/backend/src/dictionary/words.txt
```
Alternatively, you can configure the backend to fetch on boot via env (see **Environment**).

---

## Environment

Create the following files (optional).

**Backend** – `apps/backend/.env`
```
PORT=3001
NODE_ENV=development
# Optional: remote dictionary to download at startup
DICTIONARY_URL=
```

**Frontend** – `apps/frontend/.env`
```
VITE_BACKEND_URL=http://localhost:3001
```

Restart the Vite dev server after changing `VITE_*` variables.

---

## Scripts you’ll use daily

From repo root:
```bash
# All workspaces
pnpm dev            # turbo run dev --parallel
pnpm typecheck      # turbo run typecheck
pnpm lint           # turbo run lint
pnpm test           # turbo run test
pnpm test:watch     # turbo run test:watch --parallel
pnpm test:coverage  # turbo run test:coverage
pnpm build          # turbo run build
```

Focus on a workspace with filters:
```bash
pnpm -F backend test:coverage
pnpm -F frontend test:watch
pnpm -F @game/domain test
pnpm -F @word-bomb/types test
```

---

## Coding standards

- **TypeScript everywhere.** Prefer explicit types at module boundaries.
- **No `console.log` in production paths.** Use backend structured logging utilities; allow logs in tests.
- **Pure domain logic** in `packages/domain` with exhaustive unit tests.
- **Typed sockets.** Define/modify events and payloads in `packages/types` first, then wire up backend and frontend.
- **Accessibility & mobile‑first UI.** Test with small viewports and keyboard open; ensure timers and text remain legible.
- **Imports.** Keep public surfaces small; avoid deep relative imports across packages.

Optional but encouraged: add diagrams or short design notes under `docs/` when adding non‑trivial behavior.

---

## Testing policy

- **Runner:** Vitest across repo.
- **Layout:** Unit tests colocated (`*.test.ts[x]`) near sources; integration tests under `apps/**/test`.
- **Coverage:** Frontend target **100%** (no exclusions). For backend/packages keep trend upward; avoid regressions.
- **Speed:** Prefer pure tests; avoid network or timers when possible (mock/stub).

Common flows:
```bash
# Single file in watch mode
pnpm -F frontend test:watch src/components/GameBoard.test.tsx

# Single test by name
pnpm -F backend test -t "startGameForRoom emits events in order"
```

---

## Commit conventions

We use **Conventional Commits** + scopes. Examples:

```
feat(frontend): keyboard‑safe room UI
fix(backend): prevent duplicate player join
refactor(domain): simplify bonus progression
docs(repo): add contributing guide

# Breaking change
feat(types)!: rename WordSubmitted to PlayerSubmittedWord

# Chore/CI/build are fine when appropriate
```

**Allowed scopes:** `frontend | backend | domain | types | infra | docs | repo`.

---

## Pull requests

Open PRs early; keep them focused. Before creating one:

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] Tests added/updated and `pnpm test:coverage` passes (frontend ≥ 100%)
- [ ] User‑visible changes added to `CHANGELOG.md` (or explain why not)
- [ ] Docs or ADR updated if you changed a protocol or design decision

**Review tips**
- Keep files small and single‑purpose. If it’s hard to review, it’s likely two PRs.
- Avoid “drive‑by” refactors unless trivially mechanical.

---

## Releasing (lightweight)

- Use SemVer for tags.
- Maintain a `CHANGELOG.md` in **Keep a Changelog** format with an **Unreleased** section.
- Release notes can be generated from Conventional Commits, then curated.

---

## Editor/Tooling hints (optional)

- Enable ESLint and Prettier in your editor; Prettier handles Markdown and TS.
- Keep line length ~110 in prose; prefer fenced code blocks for shell/TS.
- Consider installing a Tailwind intellisense plugin if working on frontend.

---

## FAQ

**Q: Dev servers won’t connect.**  
Check `VITE_BACKEND_URL` and backend `FRONTEND_URL`; defaults are `http://localhost:3001` and `http://localhost:5173` respectively.

**Q: Gameplay in dev has no words.**  
Provide `apps/backend/src/dictionary/words.txt` or set `DICTIONARY_URL`.

**Q: TypeScript project service can’t find files.**  
Ensure tests and build outputs aren’t mis‑included; keep `dist/` out of `include`.

---

Thanks again for contributing! Keep PRs tight, tests solid, and UX intuitive.

