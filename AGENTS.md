# AGENTS.md

> **Single source of truth** for how both **automation** and **humans** operate this monorepo. Encodes exact commands, ports, paths, and guardrails so agents and people behave identically.

Monorepo layout: `apps/*`, `packages/*`.

---

## Environment

- **Frontend → Backend URL:** `VITE_BACKEND_URL` (set in `apps/frontend/.env.local`)
- **Backend → Frontend for CORS** `FRONTEND_URL` (set in `apps/backend/.env`)

---

## Canonical Commands (run at repo root)

```sh
# Install (automation/CI): never mutate lockfile
pnpm install --frozen-lockfile

# Dev
pnpm dev           # run all dev tasks in parallel (frontend + backend)
pnpm dev:backend   # backend only (listens on :3001)
pnpm dev:frontend  # frontend only (listens on :5173)

# Hygiene
pnpm format        # Prettier write (incl. Markdown)
pnpm lint          # Turborepo → per‑package ESLint
pnpm typecheck     # Turborepo → per‑package tsc --noEmit

# Tests
pnpm test          # Turborepo → per‑package tests
pnpm test:watch    # watch mode (uncached, persistent)
pnpm test:coverage # collect and report coverage across workspaces

# Build & clean
pnpm build
pnpm clean
```

**Notes**

- Turborepo fans out to package tasks per `turbo.json`.
- Use `--filter <name>` for package‑scoped runs (e.g., `pnpm --filter backend test`).
- Frontend **must** read `VITE_BACKEND_URL` for API/socket origin during dev and build.

---

## Workspace Filters (quick reference)

```sh
# Single package by name
pnpm --filter backend test

# All apps
pnpm --filter ./apps... test:coverage

# Package and its dependents
pnpm --filter "...@word-bomb/types" typecheck

# Everything except frontend
pnpm --filter "!frontend" lint
```

---

## Testing & Coverage (policy)

- Runner: **Vitest** everywhere.
- Layout: unit tests colocated (`*.test.ts[x]`), package integration under `apps/**/test`.
- **Frontend coverage target: 100%** (no file exclusions allowed). Backend/packages trend upward; no negative deltas.
- CI uploads coverage (Codecov badge in README). Treat regressions as failures.

Common invocations:

```sh
pnpm -F frontend test:coverage
pnpm -F backend test -t "startGameForRoom emits events in order"
```

---

## Lint, Typecheck, Formatting

- **ESLint:** `pnpm lint` (no warnings allowed in CI).
- **TypeScript:** `pnpm typecheck` (per‑package `tsconfig*`).
- **Prettier:** `pnpm format` before committing.
- **TSDoc:** Document exported functions, classes, and modules with TSDoc blocks so typed tooling stays accurate.
- **No** `// eslint-disable` or `@ts-ignore` without a short justification.

---

## Protocol Changes (hard rules)

When modifying socket events or payloads:

1. Edit **`packages/types/src/socket.ts`** first (single source of truth).
2. Conform to **ADR‑0002** (envelope, naming, acks, versioning).
3. If breaking: bump **protocol `v`**, support N/N‑1 on server, update `system:hello` range, and add **[BREAKING]** entry to `CHANGELOG.md`.
4. Update backend handlers and frontend validators (`apps/frontend/src/socket/eventValidators.ts`).
5. Add/adjust tests in **types**, **backend**, and **frontend**.

---

## PR Acceptance Criteria (merge gate)

A PR is acceptable **only if** ALL are true:

- `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage` pass.
- New/changed code has corresponding tests.
- Frontend coverage remains **≥ 100%**.
- User‑visible changes are recorded in `CHANGELOG.md` (Keep a Changelog).
- If a decision or protocol changed, an **ADR** is added/updated.
- Commits follow **Conventional Commits** with scopes: `frontend|backend|domain|types|infra|docs|repo`.

---

## Docs Alignment (what to update where)

- **README.md** – onboarding & repo map (link from PR if new workflows added).
- **CONTRIBUTING.md** – ports, env, scripts, commit/PR rules (keep in sync with this page).
- **CHANGELOG.md** – user‑visible changes per release, with **Unreleased** section.
- **ADR‑0002** – any socket protocol or versioning change.

---

## Troubleshooting

- **Frontend can’t reach backend:** check `VITE_BACKEND_URL` and backend `FRONTEND_URL`.
- **No words in dev:** add `apps/backend/src/dictionary/words.txt` or set `DICTIONARY_URL`.
- **Vitest sees `dist/`:** verify `tsconfig.json` excludes `dist/` and the Vitest config includes `src/**`.
- **Unexpected Turborepo runs:** config file changes are cache inputs by design (see `turbo.json`).

---

## Non‑Goals for Agents

- Do **not** modify lockfiles, `pnpm.overrides`, release tags, repo metadata, or CI workflows unless explicitly requested.
- Do **not** rewire Turborepo tasks or add root scripts without approval.
- Do **not** change ports, env var names, or dictionary paths.

---

## Appendix: Minimal Env Examples

**`apps/backend/.env`**

```
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
DICTIONARY_URL=
```

**`apps/frontend/.env.local`**

```
VITE_BACKEND_URL=http://localhost:3001
```
