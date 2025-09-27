/// <reference types="node" />
// @ts-check

import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import vitest from '@vitest/eslint-plugin';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  // Base JS + TS (type-aware)
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.stylisticTypeChecked,

  // React (flat configs)
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat['jsx-runtime'],

  // React Refresh (Vite HMR)
  reactRefresh.configs.recommended,

  // React Hooks plugin rules
  {
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },

  // Project settings for TS files
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    settings: {
      react: { version: 'detect' },
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        project: ['./tsconfig.app.json'],
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/prefer-regexp-exec': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
    },
  },

  // Vitest: ONLY apply to tests
  {
    files: ['**/*.{test,spec}.{ts,tsx}'],
    plugins: { vitest },
    rules: { ...vitest.configs.recommended.rules },
    languageOptions: {
      globals: vitest.environments.env.globals,
      parserOptions: { projectService: true }, // still type-aware in tests
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
    ],
  },

  // Put Prettier last to disable stylistic conflicts
  eslintConfigPrettier,
);
