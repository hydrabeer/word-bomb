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

  // Turn off all type-aware rules for test files; we'll lint them without type info
  {
    files: [
      '**/*.{test,spec}.ts',
      '**/*.{test,spec}.tsx',
      'apps/backend/test/**/*.ts',
    ],
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
    },
  },

  // Global TS settings for your monorepo
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: [
      '**/*.{test,spec}.ts',
      '**/*.{test,spec}.tsx',
      'apps/backend/test/**/*.ts',
      'apps/backend/src/**/*.{test,spec}.ts',
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        // Allow files not included in tsconfig (e.g., test files) to use a
        // default project for type-aware linting, avoiding parser errors.
        allowDefaultProject: true,
        tsconfigRootDir: import.meta.dirname,
        project: [
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
      // Do not use the project service for tests; avoids tsconfig include issues
      parserOptions: { projectService: false },
    },
  },

  // Backend tests live under src but are excluded from tsconfig includes.
  // Turn off the project service for them to avoid parser errors while still
  // getting core ESLint + Vitest rules.
  {
    files: [
      'apps/backend/src/**/*.{test,spec}.ts',
      // Also match when running ESLint from within apps/backend CWD
      'src/**/*.{test,spec}.ts',
    ],
    languageOptions: {
      parserOptions: { projectService: false },
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

  // Loosen strict rules for backend tests that live under src as well
  {
    files: ['apps/backend/src/**/*.{test,spec}.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
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
