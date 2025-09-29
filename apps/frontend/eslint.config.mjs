/// <reference types="node" />
// @ts-check

import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import vitest from '@vitest/eslint-plugin';
import globals from 'globals';

const TEST_GLOBS = ['**/*.{test,spec}.{ts,tsx}'];

export default tseslint.config(
  // Base JS + TS
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.stylisticTypeChecked,

  // React (flat) + new JSX runtime
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat['jsx-runtime'],

  // React Refresh (HMR)
  reactRefresh.configs.recommended,

  // React Hooks (not included in React presets)
  {
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },

  // App/source files (TS/TSX)
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    settings: { react: { version: 'detect' } },
    languageOptions: {
      // Browser globals for the app
      globals: {
        ...globals.browser,
        // Vite exposes import.meta — TS understands it; ESLint doesn't need extra globals
      },
      parserOptions: {
        projectService: true,
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname, // you can drop fileURLToPath()
      },
    },
  },

  // Vitest: ONLY for tests
  {
    files: TEST_GLOBS,
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
    languageOptions: {
      // Vitest globals; keep type-aware IF your tsconfig includes tests.
      // If not, switch to projectService:false to avoid parser errors / speed up.
      globals: vitest.environments.env.globals,
      parserOptions: {
        projectService: true,
        project: ['./tsconfig.test.json'], // <-- point at test project
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Ignore build artifacts & static assets
  {
    ignores: [
      'dist',
      'node_modules',
      'index.html',
      '**/*.css',
      'public/**',
      'vite.config.ts',
      'vitest.config.ts',
    ],
  },

  // Prettier last
  eslintConfigPrettier,
);
