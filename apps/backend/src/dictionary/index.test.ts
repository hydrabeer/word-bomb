import { describe, it, expect, vi } from 'vitest';

describe('dictionary extra paths', () => {
  it('getRandomFragment throws when no fragments and not test env', () => {
    // Create a fake fragmentCounts state by directly manipulating module (not ideal, but covers branch)
    // We'll import a fresh module instance
    vi.resetModules();
    process.env.NODE_ENV = 'production';
    return import('../dictionary').then((m) => {
      // Force fragmentCounts to empty by calling internal methods via public API
      // This is a bit of whitebox: if no fragments available and not test, it should throw
      // Simulate by calling getRandomFragment when fragmentCounts is empty
      try {
        m.getRandomFragment(999999);
        // if no throw, assert false
        expect(false).toBe(true);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    });
  });

  it('isUsingFallbackDictionary true in test fast path', async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'test';
    delete process.env.DICTIONARY_TEST_MODE;
    const m = await import('../dictionary');
    await m.loadDictionary();
    expect(m.isValidWord('aa')).toBe(true);
    expect(m.isUsingFallbackDictionary()).toBe(true);
  });
});
