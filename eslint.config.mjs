// @ts-check

import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';
import vitest from '@vitest/eslint-plugin';

export default tseslint.config(
  // Base JS/** recommendations
  eslint.configs.recommended,

  // TS-ESLint v8 presets (type-aware + stylistic)
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,

  // Global TS settings for your monorepo
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        project: [
          './tsconfig.base.json',
          './apps/backend/tsconfig.json',
          './apps/frontend/tsconfig.json',
          './packages/domain/tsconfig.json',
          './packages/types/tsconfig.json',
        ],
      },
    },
    rules: {
      // place shared TS rules here as needed
    },
  },

  // Vitest: ONLY for test files
  {
    files: [
      '**/*.{test,spec}.ts',
      '**/*.{test,spec}.tsx',
      'apps/backend/test/**/*.ts',
    ],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
    },
    languageOptions: {
      // give describe/it/expect globals
      globals: vitest.environments.env.globals,
      parserOptions: {
        projectService: true,
      },
    },
  },

  // Loosen a few rules in backend tests that hit dynamic socket shapes
  {
    files: ['apps/backend/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },

  // Tooling configs (vite/vitest) — no project service (avoids include errors)
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

  // Put Prettier last to disable conflicting stylistic rules
  eslintConfigPrettier,
);
