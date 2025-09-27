// /apps/backend/vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  root: __dirname, // ⬅️ important in a monorepo
  resolve: {
    alias: {
      '@game/domain': path.resolve(
        __dirname,
        '../../packages/domain/src/index.ts',
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'test/**/*.{test,spec}.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**', // ⬅️ keep
      '**/build/**',
      '**/coverage/**',
      '**/.{git,cache,output,temp}/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      // ⬇️ constrain coverage to source only
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/dist/**', // ⬅️ add back
        '**/build/**',
        '**/*.d.ts',
        'vitest.config.*',
        'test/**',
        'src/**/__tests__/**',
        'src/**/testutils/**',
        // your existing one
        'src/socket/typedSocket.ts',
      ],
    },
  },
});
