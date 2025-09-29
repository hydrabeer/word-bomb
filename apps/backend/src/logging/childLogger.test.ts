import { describe, it, expect } from 'vitest';

describe('logging childLogger', () => {
  it('childLogger returns a logger when context initialized', async () => {
    const mod = await import('./context');
    const logger = { info: () => undefined, child: () => logger } as any;
    mod.initializeLoggerContext(logger);
    const child = mod.childLogger({ reqId: 'x' });
    expect(child).not.toBeNull();
  });
});
