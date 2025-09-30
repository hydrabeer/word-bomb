# AGENTS.md

## Purpose

This document provides clear guidance for agents working in this monorepo. It covers environment setup, testing, linting, and acceptance criteria to ensure consistency, maintainability, and high-quality contributions.

---

## Dev Environment Tips

- To bootstrap the whole workspace, run `pnpm install` at the root.
- In CI or automated contexts, prefer `pnpm install --frozen-lockfile`.

---

## Testing Instructions

- CI plans are located in `.github/workflows/`.
- Run all checks for a package:
  ```sh
  pnpm --filter <project_name> test
  ```
- From inside a package, you can run:
  ```sh
  pnpm test
  ```
- Run the full test suite across the repo:
  ```sh
  # From the root
  pnpm test
  ```
- To focus on one test case:
  ```sh
  pnpm test -t "<test name>"
  ```
- Run linting/type checks after moving files or changing imports:
  ```sh
  pnpm --filter <project_name> lint
  ```
- For coverage in a package:
  ```sh
  pnpm --filter <project_name> test:coverage 
  ```

### Test File Conventions

- All test files must end in `.test.ts`.
- The base name should match the module under test.
  - Example: `roomManager.test.ts` for `roomManager.ts`.
- Always add or update tests for any code you change.

### Error Handling

- Fix errors rather than suppressing them.
- Never use `// eslint-disable` or `@ts-ignore` without a justification comment.

---

## Acceptance Criteria

A commit or PR is acceptable only if:

- Code is formatted: `pnpm format`
- No lint errors: `pnpm lint`
- All tests pass with high coverage: `pnpm test:coverage`
- New or changed code has corresponding tests
- No unjustified use of `eslint-disable` or `@ts-ignore`

---

## Commit Guidelines

- Use conventional commit messages where possible:
  - Examples: `feat: add new scoring system`, `fix: correct fragment indexing`, `chore: update dependencies`
- Write concise, descriptive messages.

---

## CI/CD Expectations

- All CI jobs must pass before merging.
- Coverage thresholds defined in the repo must be met.
- Failing checks are blockers for merge.

---

## Agent Boundaries

- Agents should:
  - Run all required checks (`pnpm format`, `pnpm lint`, `pnpm test`) before proposing commits.
  - Avoid version bumps in `package.json` unless explicitly instructed.
  - Treat failing workflows as blockers.
