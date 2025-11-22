import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  cacheDir: '.vite',
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
    globals: true,
    unstubEnvs: true,
    exclude: ['**/node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'frontend-jsdom',
          environment: 'jsdom',
          setupFiles: ['./src/setupTests.ts'],
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
          exclude: [
            'src/api/**/*.test.ts',
            'src/socket/**/*.test.ts',
            'src/socket.test.ts',
            'src/utils/**/*.test.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'frontend-node',
          environment: 'node',
          include: [
            'src/api/**/*.test.ts',
            'src/socket/**/*.test.ts',
            'src/socket.test.ts',
            'src/utils/**/*.test.ts',
          ],
        },
      },
    ],
  },
});
