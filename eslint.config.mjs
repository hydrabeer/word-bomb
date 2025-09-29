// @ts-check

import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';
import vitest from '@vitest/eslint-plugin';
import importX from 'eslint-plugin-import-x';

/** Single source of truth for test globs */
const TEST_GLOBS = [
  '**/*.{test,spec}.ts',
  '**/*.{test,spec}.tsx',
  'apps/backend/test/**/*.ts',
];

export default tseslint.config(
  // 1) Base JS rules
  eslint.configs.recommended,

  // 2) TypeScript strict presets (type-aware)
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,

  // 3) Source files: type-aware + monorepo import hygiene
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: [
      ...TEST_GLOBS, // tests handled below
      '**/vitest.config.*',
      '**/vite.config.*',
      '**/eslint.config.*',
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        // allowDefaultProject defaults to false with projectService=true
        tsconfigRootDir: import.meta.dirname,
        project: [
          './apps/backend/tsconfig.json',
          './apps/frontend/tsconfig.json',
          './packages/domain/tsconfig.json',
          './packages/types/tsconfig.json',
        ],
      },
    },
    plugins: { 'import-x': importX },
    rules: {
      // Monorepo/module rules (not provided by TS/ESLint packs)
      'import-x/no-self-import': 'error',
      'import-x/no-relative-packages': 'error',
      'import-x/no-cycle': ['error', { maxDepth: 6 }],
      'import-x/no-extraneous-dependencies': [
        'error',
        {
          packageDir: [
            '.',
            'apps/backend',
            'apps/frontend',
            'packages/domain',
            'packages/types',
          ],
        },
      ],
    },
  },

  // 4) Tests: non type-aware + Vitest rules/globals
  {
    files: TEST_GLOBS,
    languageOptions: {
      parserOptions: { projectService: false },
      globals: vitest.environments.env.globals,
    },
    plugins: { vitest },
    rules: {
      // Drop all type-aware rules and their noise in tests
      ...tseslint.configs.disableTypeChecked.rules,

      // Vitest recommendations
      ...vitest.configs.recommended.rules,

      // Practical loosening in tests
      '@typescript-eslint/no-explicit-any': 'off',
      // (unsafe-* are already off via disableTypeChecked)
    },
  },

  // 5) Tooling/config files: non type-aware to avoid include errors
  {
    files: [
      '**/vitest.config.{ts,cts,mts,js,cjs,mjs}',
      '**/vite.config.{ts,cts,mts,js,cjs,mjs}',
      '**/eslint.config.{ts,js,mjs,cjs}',
      'tools/**/*.ts',
    ],
    languageOptions: {
      parserOptions: { projectService: false },
    },
  },

  // 6) Prettier last to disable stylistic conflicts
  eslintConfigPrettier,
);
