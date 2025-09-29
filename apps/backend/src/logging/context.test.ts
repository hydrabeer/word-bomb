import { describe, it, expect, vi } from 'vitest';

// Ensure a fresh module state so AsyncLocalStorage has no store for one test
vi.resetModules();

describe('logging/context module', () => {
  it('childLogger returns null when no context initialized', async () => {
    const mod = await import('./context');
    // childLogger should return null if storage has no active store
    const res = mod.childLogger({ reqId: 'x' });
    expect(res).toBeNull();
  });

  it('withLogContext and getLogger/getLogContext work together', async () => {
    const {
      initializeLoggerContext,
      getLogger,
      withLogContext,
      getLogContext,
    } = await import('./context');

    // Create a tiny logger-like object
    const logger = { info: () => undefined, child: () => logger } as any;
    initializeLoggerContext(logger);

    const seen: string[] = [];
    withLogContext({ reqId: 'r1' }, () => {
      const l = getLogger();
      expect(typeof l.child).toBe('function');
      seen.push('ran');
      const ctx = getLogContext();
      expect(ctx.reqId).toBe('r1');
    });
    expect(seen).toEqual(['ran']);
  });
});
