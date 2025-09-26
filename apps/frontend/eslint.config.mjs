/// <reference types="node" />
// @ts-check

import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import vitest from 'eslint-plugin-vitest';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  // Base ESLint + TypeScript configs
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.stylisticTypeChecked,

  // vitest plugin
  vitest.configs.recommended,

  // React plugin
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat['jsx-runtime'],

  // React Refresh plugin
  reactRefresh.configs.recommended,

  eslintConfigPrettier,
  // React Hooks plugin
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },

  // Custom project-level settings (scoped to TS files)
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    settings: {
      react: {
        version: 'detect', // auto-detect from package.json
      },
    },
    rules: {
      '@typescript-eslint/prefer-regexp-exec': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
    },
    ignores: [
      'dist', // Vite build output
      'node_modules', // Always ignore
      'vite.config.ts',
      'index.html',
      '**/*.css', // Optional: ignore CSS files
      'public/**', // Optional: static assets
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        project: ['./tsconfig.app.json'],
        tsconfigRootDir: __dirname,
      },
    },
  },
);
