import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // No runtime code to meaningfully cover; exclude everything to avoid skewing global metrics
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      exclude: ['**/*'],
    },
  },
});
