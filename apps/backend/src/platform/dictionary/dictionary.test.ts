import { describe, it, expect, vi, beforeEach } from 'vitest';

// We'll snapshot & restore relevant env vars we touch.
const ORIGINAL_ENV = { ...process.env };

function setEnv(env: NodeJS.ProcessEnv) {
  process.env = { ...ORIGINAL_ENV, ...env };
}

// Utility to dynamically import a FRESH copy of the dictionary module after resetting modules.
async function freshDictionary() {
  const mod = await import('.');
  return mod;
}

describe('dictionary module full coverage', () => {
  beforeEach(() => {
    vi.resetModules();
    setEnv({ NODE_ENV: 'test' });
  });

  it('loads locally (non-prod) & covers isValidWord + random fragment normal path', async () => {
    const { loadDictionary, isValidWord, getRandomFragment } =
      await freshDictionary();
    await loadDictionary();
    expect(isValidWord('AA')).toBe(true);
    const frag = getRandomFragment(1);
    expect(frag.length === 2 || frag.length === 3).toBe(true);
  });

  it('loads the on-disk dictionary when DICTIONARY_TEST_MODE forces full load', async () => {
    setEnv({ NODE_ENV: 'test', DICTIONARY_TEST_MODE: 'full' });
    const sample = [
      'apple',
      'banana',
      'supercalifragilisticexpialidocious',
    ].join('\n');
    const readSpy = vi.fn(() => sample);
    vi.doMock(
      'fs',
      () =>
        ({
          readFileSync: readSpy,
          default: { readFileSync: readSpy },
        }) as unknown as typeof import('fs'),
    );
    const { loadDictionary, isValidWord, getDictionaryStats } =
      await freshDictionary();
    await loadDictionary();
    expect(readSpy).toHaveBeenCalled();
    expect(isValidWord('apple')).toBe(true);
    expect(isValidWord('BANANA')).toBe(true);
    // Word longer than 30 chars should be filtered out
    expect(isValidWord('supercalifragilisticexpialidocious')).toBe(false);
    const stats = getDictionaryStats();
    expect(stats.wordCount).toBe(2);
    expect(stats.fragmentCount).toBeGreaterThan(0);
  });

  it('reads dictionary from /tmp/words.txt in production', async () => {
    setEnv({ NODE_ENV: 'production' });
    const readSpy = vi.fn(() => ['aa', 'ab'].join('\n'));
    vi.doMock(
      'fs',
      () =>
        ({
          readFileSync: readSpy,
          default: { readFileSync: readSpy },
        }) as unknown as typeof import('fs'),
    );
    const { loadDictionary, isValidWord } = await freshDictionary();
    await loadDictionary();
    expect(readSpy).toHaveBeenCalledWith('/tmp/words.txt', 'utf-8');
    expect(isValidWord('aa')).toBe(true);
  });

  it('returns the most frequent fragment as fallback when threshold is unmet', async () => {
    setEnv({ NODE_ENV: 'development' });
    const sample = ['aaaa', 'aaab'].join('\n');
    const readSpy = vi.fn(() => sample);
    vi.doMock(
      'fs',
      () =>
        ({
          readFileSync: readSpy,
          default: { readFileSync: readSpy },
        }) as unknown as typeof import('fs'),
    );
    const { loadDictionary, getRandomFragment } = await freshDictionary();
    await loadDictionary();
    const fragment = getRandomFragment(999);
    expect(fragment).toBe('aa');
  });

  it('outer readFileSync try/catch path when file read fails', async () => {
    setEnv({ NODE_ENV: 'development' });
    vi.doMock(
      'fs',
      () =>
        ({
          readFileSync: () => {
            throw new Error('boom');
          },
          default: {
            readFileSync: () => {
              throw new Error('boom');
            },
          } as unknown,
        }) as unknown as typeof import('fs'),
    );
    const { loadDictionary } = await freshDictionary();
    await loadDictionary(); // should not throw
    expect(true).toBe(true); // ensure assertion for lint rule
  });

  it('getRandomFragment throws when no candidates and not in test env', async () => {
    setEnv({ NODE_ENV: 'production' });
    const { getRandomFragment } = await freshDictionary();
    // fragmentCounts empty; should throw
    expect(() => getRandomFragment(1)).toThrow(/No fragments/);
  });

  it('getRandomFragment returns deterministic fallback in test env when empty', async () => {
    setEnv({ NODE_ENV: 'test' });
    vi.resetModules();
    const { getRandomFragment } = await freshDictionary();
    // Without loading dictionary, fragmentCounts is empty; in test env it should return 'aa'.
    expect(getRandomFragment(1)).toBe('aa');
  });

  it('getRandomFragment throws when no fragments and not test env', () => {
    // Create a fake fragmentCounts state by directly manipulating module (not ideal, but covers branch)
    // We'll import a fresh module instance
    vi.resetModules();
    process.env.NODE_ENV = 'production';
    const OUT_OF_RANGE_FRAGMENT_INDEX = 999999; // Used to trigger error when no fragments are available
    return import('../dictionary').then((m) => {
      // Force fragmentCounts to empty by calling internal methods via public API
      // This is a bit of whitebox: if no fragments available and not test, it should throw
      // Simulate by calling getRandomFragment when fragmentCounts is empty
      expect(() => m.getRandomFragment(OUT_OF_RANGE_FRAGMENT_INDEX)).toThrow(
        Error,
      );
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

  it('createDictionaryPort exposes isValid and getRandomFragment', async () => {
    setEnv({ NODE_ENV: 'test' });
    const { loadDictionary, createDictionaryPort } = await freshDictionary();
    await loadDictionary();
    const port = createDictionaryPort();
    expect(port.isValid('AA')).toBe(true);
    const fragment = port.getRandomFragment(1);
    expect(fragment.length === 2 || fragment.length === 3).toBe(true);
  });
});
