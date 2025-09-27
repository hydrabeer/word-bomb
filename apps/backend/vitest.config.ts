import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Ensure Vitest resolves the domain public API via the same entrypoint as runtime code.

export default defineConfig({
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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        // types-only socket wrappers shouldn't count toward coverage
        'src/socket/typedSocket.ts',
      ],
    },
  },
});
