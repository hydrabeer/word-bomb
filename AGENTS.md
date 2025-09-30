# AGENTS.md

## Purpose

This guide gives **agents** and **human contributors** a single, exact workflow for this monorepo. It encodes the repo’s real scripts, tools, and conventions so automation and people do the same thing.

> Monorepo layout: `apps/*`, `packages/*` (from `pnpm-workspace.yaml`).

---

## Canonical Commands (run at repo root)

```sh
# Install (human): installs everything with lockfile updates allowed
pnpm install

# Install (automation/CI): never mutate lockfile
pnpm install --frozen-lockfile

# Dev
pnpm dev          # runs all dev tasks in parallel
pnpm dev:backend  # only backend
pnpm dev:frontend # only frontend

# Format, lint, typecheck, test
pnpm format       # Prettier write
pnpm lint         # Turborepo -> per‑package lint tasks
pnpm typecheck    # Turborepo -> per‑package typecheck
pnpm test         # Turborepo -> per‑package test
pnpm test:watch   # watch mode (uncached, persistent)
pnpm test:coverage

# Build & clean
pnpm build
pnpm clean
```

**Notes**

- The repo uses **Turborepo**; all above commands fan out to package tasks per `turbo.json`.
- Prettier is configured with `prettier-plugin-tailwindcss`; use `pnpm format` before every commit.
- Use `--filter <project_name>` for package‑scoped commands when needed (e.g., `pnpm --filter backend test`).

---

## Testing Instructions

- CI plans live in `.github/workflows/`.
- Run a package’s tests:
  ```sh
  pnpm --filter <project_name> test
  ```
- From inside a package directory, `pnpm test` is sufficient.
- Focus a single test with Vitest:
  ```sh
  pnpm --filter <project_name> test -t "<test name>"
  ```
- Coverage for a package:
  ```sh
  pnpm --filter <project_name> test:coverage
  ```
- After moving files or changing imports, verify lint/type rules:
  ```sh
  pnpm --filter <project_name> lint
  pnpm --filter <project_name> typecheck
  ```

### Test File Conventions

- **All** test files end with `.test.ts`.
- Base name mirrors the module under test (e.g., `roomManager.ts` ↔ `roomManager.test.ts`).
- Add/update tests for any changed code.

### Error Handling

- Fix errors rather than suppressing them.
- No `// eslint-disable` or `@ts-ignore` without a short justification comment.

---

## Lint, Typecheck, and Formatting

- **Lint** is driven by Turborepo per‐package tasks; cache artifacts are stored as `.eslintcache` (see `turbo.json`).
- **Typecheck** runs with per‐package `tsconfig*` inputs (see `turbo.json`). Ensure project references are up to date when adding packages.
- **Format** uses Prettier with Tailwind plugin; run `pnpm format` at root.

> Recommendation: add non‑mutating checks (optional, see below) so CI can verify without rewriting.

---

## Acceptance Criteria (hard requirements)

A commit/PR is acceptable only if **all** are true:

- Code is formatted: `pnpm format` has been run
- Lint passes: `pnpm lint`
- Typecheck passes: `pnpm typecheck`
- Tests pass: `pnpm test` (and coverage where required)
- New/changed code has corresponding tests
- No unjustified `eslint-disable`/`@ts-ignore`

Treat any CI failure as a merge blocker.

---

## Scripts & Tasks (source of truth)

From `package.json` (root):

- `build` → `turbo run build`
- `clean` → `turbo run clean`
- `dev` → `turbo run dev --parallel`
- `dev:backend` → `pnpm --filter backend dev`
- `dev:frontend` → `pnpm --filter frontend dev`
- `format` → `prettier --write .`
- `lint` → `turbo run lint`
- `typecheck` → `turbo run typecheck`
- `test` → `turbo run test`
- `test:watch` → `turbo run test:watch --parallel`
- `test:coverage` → `turbo run test:coverage`

From `turbo.json` (task shape):

- `build` depends on parent builds; outputs: `dist/**`, `tsconfig*.tsbuildinfo`
- `lint` depends on parent lint; inputs: `**/*.{ts,tsx}`, config files; outputs: `.eslintcache`
- `test` depends on parent tests; inputs: TS files + `vitest.config.*`; outputs: `.vite/vitest`
- `test:coverage` depends on parent tests; outputs: `coverage/**`, `.vite/vitest`
- `test:watch` is persistent and uncached
- `typecheck` depends on parent typechecks; inputs include TS and `tsconfig*`

> Implication: if you change TS, ESLint, or Vitest config in one package, up‑tree dependents will re‑run via Turborepo.

---

## Workspace Filters (examples)

```sh
# Single package
pnpm --filter backend test

# All apps only
pnpm --filter ./apps... test

# A package and its dependents
pnpm --filter "...@word-bomb/types" typecheck

# Everything except frontend
pnpm --filter "!frontend" lint
```

> Use filters to keep hot loops fast while preserving correctness.

---

## Agent Boundaries

Agents **must**:

- Use `pnpm install --frozen-lockfile` in automation.
- Run `pnpm format && pnpm lint && pnpm typecheck && pnpm test` before proposing commits.
- Prefer filtered runs (`--filter <project_name>`) when changing a single package, then a final root run before commit.
- Never alter `pnpm.overrides`, lockfiles, or version ranges unless explicitly requested.
- Avoid bumping versions or changing release/repo metadata.

Agents **should not**:

- Modify Turborepo task wiring (`turbo.json`) without explicit instruction.
- Introduce new scripts at root unless asked.

---

---

## Troubleshooting (common gotchas)

- **Tests pulling from `dist/`**: ensure packages’ `tsconfig.json` exclude `dist` and that Vitest includes only `src`.
- **Filters not matching**: confirm package names via each `package.json` (not the root) and prefer name‑based filters when ambiguous.
- **Unexpected re‑runs**: Turborepo caches by `inputs`/`outputs`; changing config files listed in `turbo.json` invalidates caches by design.

---

## Security & Hygiene

- Do not commit secrets. Use `.env` + `.env.example` patterns.
- Avoid adding new direct dependencies in leaf packages when a shared package can own them.
- Keep dependency graphs tidy (use your chosen tool e.g., dependency‑cruiser for audits).
