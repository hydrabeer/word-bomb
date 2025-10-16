/// <reference types="node" />

import { defineConfig } from 'eslint/config';
import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import vitest from '@vitest/eslint-plugin';
import globals from 'globals';

const require = createRequire(import.meta.url);
const tsconfigPath = require.resolve(
  '@word-bomb/typescript-config/eslint.json',
);
process.env.ESLINT_TSCONFIG ??= tsconfigPath;

const TEST_GLOBS = ['**/*.{test,spec}.{ts,tsx}'] as const;
const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));
const reactHooksPlugin = reactHooks as any;
const vitestPlugin = vitest as any;

export default defineConfig([
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat['jsx-runtime'],
  reactRefresh.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooksPlugin },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    settings: { react: { version: 'detect' } },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        projectService: true,
        project: ['./tsconfig.json'],
        tsconfigRootDir,
      },
    },
  },
  {
    files: [...TEST_GLOBS],
    plugins: { vitest: vitestPlugin },
    rules: {
      ...vitest.configs.recommended.rules,
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
    languageOptions: {
      globals: vitest.environments.env.globals,
      parserOptions: {
        projectService: true,
        project: ['./tsconfig.test.json'],
        tsconfigRootDir,
      },
    },
  },
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
  eslintConfigPrettier,
]);
