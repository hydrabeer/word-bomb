/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  options: {
    // only crawl source & tests in workspaces
    includeOnly: {
      path: [
        '^apps/[^/]+/(src|test|tests)/',
        '^packages/[^/]+/(src|test|tests)/',
      ],
    },

    // never follow dependencies inside node_modules
    doNotFollow: { path: 'node_modules' },

    // exclude build outputs, coverage, assets, config, etc.
    exclude: {
      path: [
        '^node_modules',
        '/dist(/|$)',
        '/build(/|$)',
        '/coverage(/|$)',
        '/lcov-report(/|$)',
        '/public(/|$)',
        '\\.d\\.ts$',
        '\\.(stories|spec|test)\\.(js|jsx|ts|tsx)$', // tests still included by includeOnly above if under test(s)/
      ],
    },

    // typescript resolution using your base config
    tsConfig: { fileName: './tsconfig.base.json' },

    // nicer output
    combinedDependencies: true,
    reporterOptions: { dot: { theme: { graph: { rankdir: 'LR' } } } },
  },

  forbidden: [
    // apps must not import other apps (but intra-app is allowed)
    {
      name: 'frontend-must-not-import-backend',
      severity: 'error',
      from: { path: '^apps/frontend/' },
      to: { path: '^apps/backend/' },
    },
    {
      name: 'backend-must-not-import-frontend',
      severity: 'error',
      from: { path: '^apps/backend/' },
      to: { path: '^apps/frontend/' },
    },

    {
      name: 'no-package-to-app',
      severity: 'error',
      from: { path: '^packages/[^/]+' },
      to: { path: '^apps/[^/]+' },
    },
    {
      name: 'apps-no-deep-internal',
      severity: 'error',
      from: { path: '^apps/[^/]+' },
      to: { path: '^packages/[^/]+/src/.+' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      from: {
        orphan: true,
        // ignore real entrypoints and common config/test roots
        pathNot:
          '(' +
          // app entry files
          '^apps/frontend/src/main\\.tsx$' +
          '|' +
          '^apps/backend/src/index\\.ts$' +
          '|' +
          // package barrels (any index.ts under packages/*/src/)
          '^packages/[^/]+/src/index\\.ts$' +
          '|' +
          // configs and tests we don’t care to flag as orphans
          '\\.(test|spec)\\.(ts|tsx)$' +
          '|' +
          '(^|/)vitest\\.config\\.(ts|js|mjs|cjs)$' +
          '|' +
          '(^|/)vite\\.config\\.(ts|js|mjs|cjs)$' +
          ')',
      },
      to: {},
    },
    {
      name: 'no-dev-deps-in-runtime',
      severity: 'error',
      from: {
        path: '^(apps|packages)/',
        pathNot:
          '(\\.test\\.|/test/|/tests/|/__tests__/|vitest\\.config|jest\\.config|eslint|vite\\.config)',
      },
      to: { dependencyTypes: ['npm-dev'] },
    },
  ],
};
