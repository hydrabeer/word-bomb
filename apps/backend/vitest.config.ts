// /apps/backend/vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  cacheDir: '.vite',
  root: __dirname,
  resolve: {
    alias: [
      {
        find: /^@game\/domain\/(.*)$/,
        replacement: path.resolve(__dirname, '../../packages/domain/src/$1'),
      },
      {
        find: /^@word-bomb\/types\/(.*)$/,
        replacement: path.resolve(__dirname, '../../packages/types/src/$1'),
      },
      {
        find: /^@backend\/(.*)$/,
        replacement: path.resolve(__dirname, 'src/$1'),
      },
      {
        find: /^@platform\/(.*)$/,
        replacement: path.resolve(__dirname, 'src/platform/$1'),
      },
      {
        find: /^@features\/(.*)$/,
        replacement: path.resolve(__dirname, 'src/features/$1'),
      },
      {
        find: /^@rooms\/(.*)$/,
        replacement: path.resolve(__dirname, 'src/features/rooms/$1'),
      },
      {
        find: /^@gameplay\/(.*)$/,
        replacement: path.resolve(__dirname, 'src/features/gameplay/$1'),
      },
      {
        find: /^@shared\/(.*)$/,
        replacement: path.resolve(__dirname, 'src/shared/$1'),
      },
    ],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'test/**/*.{test,spec}.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.{git,cache,output,temp}/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.d.ts',
        'vitest.config.*',
        'test/**',
        '**/*.test.ts',
        'src/**/__tests__/**',
        'src/**/testutils/**',
        'src/socket/typedSocket.ts',
      ],
    },
  },
});
