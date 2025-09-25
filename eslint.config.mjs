// @ts-check

import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';
import vitest from 'eslint-plugin-vitest';

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  vitest.configs.recommended,
  eslintConfigPrettier,
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
        ],
      },
    },
    rules: {},
  },
  {
    files: ['apps/backend/test/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        project: ['./apps/backend/tsconfig.json'],
      },
    },
    rules: {
      // Tests interact with dynamic runtime socket objects; loosen unsafe rules here only
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
);
