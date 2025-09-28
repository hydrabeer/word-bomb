import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
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
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
    },
  },
});
