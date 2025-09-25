import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Ensure tsconfig path alias "@game/domain/*" works in Vitest by mapping it here.
// Without this, runtime module resolution fails with "Cannot find package '@game/domain/..." errors
// because Vite/Vitest does not honor tsconfig "paths" automatically.

export default defineConfig({
  resolve: {
    alias: {
      '@game/domain': path.resolve(__dirname, '../../packages/domain/src'),
    },
  },
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
    },
  },
});
