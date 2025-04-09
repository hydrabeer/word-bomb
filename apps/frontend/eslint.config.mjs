// @ts-check

import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  // Base ESLint + TypeScript configs
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.stylisticTypeChecked,

  // React plugin
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat['jsx-runtime'],

  // React Refresh plugin
  reactRefresh.configs.vite,

  eslintConfigPrettier,
  // React Hooks plugin
  {
    plugins: {
      'react-hooks': reactHooks
    },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules
    }
  },

  // Custom project-level settings
  {
    settings: {
      react: {
        version: 'detect' // auto-detect from package.json
      }
    },
    rules: {
      '@typescript-eslint/prefer-regexp-exec': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off'
    },
    ignores: [
      'dist',         // Vite build output
      'node_modules', // Always ignore
      'vite.config.ts',
      'index.html',
      '**/*.css',     // Optional: ignore CSS files
      'public/**'     // Optional: static assets
    ],
    root: true,
    languageOptions: {
      parserOptions: {
        projectService: true,
        project: ['./tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname
      }
    }
  }
)
;