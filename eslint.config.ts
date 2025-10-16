import { defineConfig } from 'eslint/config';
import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import importX from 'eslint-plugin-import-x';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';
import vitest from '@vitest/eslint-plugin';

const require = createRequire(import.meta.url);
const tsconfigPath = require.resolve(
  '@word-bomb/typescript-config/eslint.json',
);
process.env.ESLINT_TSCONFIG ??= tsconfigPath;

const TEST_GLOBS = [
  '**/*.{test,spec}.ts',
  '**/*.{test,spec}.tsx',
  'apps/backend/test/**/*.ts',
] as const;

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

const importXPlugin = importX as any;
const vitestPlugin = vitest as any;

export default defineConfig([
  // 1) Base JS rules
  eslint.configs.recommended,

  // 2) TypeScript strict presets (type-aware)
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // 3) Source files: type-aware + monorepo import hygiene
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: [
      ...TEST_GLOBS,
      '**/vitest.config.*',
      '**/vite.config.*',
      '**/eslint.config.*',
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir,
        project: [
          './apps/backend/tsconfig.json',
          './apps/frontend/tsconfig.json',
          './packages/domain/tsconfig.json',
          './packages/types/tsconfig.json',
        ],
      },
    },
    plugins: { 'import-x': importXPlugin },
    rules: {
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
    files: [...TEST_GLOBS],
    languageOptions: {
      parserOptions: { projectService: false },
      globals: vitest.environments.env.globals,
    },
    plugins: { vitest: vitestPlugin },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      ...vitest.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
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
]);
