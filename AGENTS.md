# AGENTS.md

## Dev environment tips

- Run `pnpm install --filter <project_name>` to add the package to your workspace so Vite, ESLint, and TypeScript can see it.
- Check the name field inside each package's package.json to confirm the right name—skip the top-level one.

## Testing instructions

- Find the CI plan in the .github/workflows folder.
- Run `pnpm test --filter <project_name>` to run every check defined for that package.
- From the package root you can just call `pnpm test`. The commit should pass all tests before you merge.
- To focus on one step, add the Vitest pattern: `pnpm test -t "<test name>"`.
- Fix any test or type errors until the whole suite is green.
- After moving files or changing imports, run `pnpm lint --filter <project_name>` to be sure ESLint and TypeScript rules still pass.
- Add or update tests for the code you change, even if nobody asked.
- The names of test files should match the modules they test. That said, it is preferred to modify the name of a file rather than use `.*.test.ts` extensions. All test files should simply end with `.test.ts`.
- Fix errors rather than suppressing them.

## Acceptance criteria
- Always run `pnpm format`, `pnpm lint`, and `pnpm test` before committing.
