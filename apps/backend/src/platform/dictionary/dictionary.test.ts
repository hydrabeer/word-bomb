import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Helpers: fast env stubbing and fresh imports per test (Vitest best practice)
const importFresh = async () => {
  vi.resetModules();
  return import('.');
};

const mockFsWith = (content: string) => {
  const readFileSync = vi.fn(() => content);
  vi.doMock(
    'fs',
    () =>
      ({
        readFileSync,
        default: { readFileSync },
      }) as unknown as typeof import('fs'),
  );
  return readFileSync;
};

const mockFsThrow = (message = 'boom') => {
  const fail = () => {
    throw new Error(message);
  };
  vi.doMock(
    'fs',
    () =>
      ({
        readFileSync: fail,
        default: { readFileSync: fail },
      }) as unknown as typeof import('fs'),
  );
};

describe('dictionary module', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unmock('fs');
    vi.unstubAllEnvs?.();
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unmock('fs');
    vi.unstubAllEnvs?.();
  });

  it('loads fallback (test fast path) and validates + fragments normally', async () => {
    const { loadDictionary, isValidWord, getRandomFragment } =
      await importFresh();
    await loadDictionary();
    expect(isValidWord('AA')).toBe(true);
    const frag = getRandomFragment(1);
    expect([2, 3]).toContain(frag.length);
  });

  it('forces full file load with DICTIONARY_TEST_MODE=full (filters >30 chars)', async () => {
    vi.stubEnv('DICTIONARY_TEST_MODE', 'full');
    const sample = [
      'apple',
      'banana',
      'supercalifragilisticexpialidocious',
    ].join('\n');
    const readSpy = mockFsWith(sample);

    const { loadDictionary, isValidWord, getDictionaryStats } =
      await importFresh();
    await loadDictionary();

    expect(readSpy).toHaveBeenCalled();
    expect(isValidWord('apple')).toBe(true);
    expect(isValidWord('BANANA')).toBe(true);
    expect(isValidWord('supercalifragilisticexpialidocious')).toBe(false);

    const stats = getDictionaryStats();
    expect(stats.wordCount).toBe(2);
    expect(stats.fragmentCount).toBeGreaterThan(0);
  });

  it('reads /tmp/words.txt when NODE_ENV=production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const readSpy = mockFsWith(['aa', 'ab'].join('\n'));
    const { loadDictionary, isValidWord } = await importFresh();
    await loadDictionary();
    expect(readSpy).toHaveBeenCalledWith('/tmp/words.txt', 'utf-8');
    expect(isValidWord('aa')).toBe(true);
  });

  it('falls back to most frequent fragment in non-test env when threshold unmet', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const readSpy = mockFsWith(['aaaa', 'aaab'].join('\n'));
    const { loadDictionary, getRandomFragment } = await importFresh();
    await loadDictionary();
    expect(readSpy).toHaveBeenCalled();
    expect(getRandomFragment(999)).toBe('aa');
  });

  it('non-prod load error triggers fallback dictionary', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    mockFsThrow();
    const { loadDictionary, isUsingFallbackDictionary } = await importFresh();
    await loadDictionary();
    expect(isUsingFallbackDictionary()).toBe(true);
  });

  it('throws when no fragments available and not test env', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { getRandomFragment } = await importFresh();
    expect(() => getRandomFragment(1)).toThrow(/No fragments/);
  });

  it('returns deterministic "aa" when empty in test env', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const { getRandomFragment } = await importFresh();
    expect(getRandomFragment(1)).toBe('aa');
  });

  it('reports fallback usage in test fast path after load', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('DICTIONARY_TEST_MODE', undefined as unknown as string);
    const m = await importFresh();
    await m.loadDictionary();
    expect(m.isValidWord('aa')).toBe(true);
    expect(m.isUsingFallbackDictionary()).toBe(true);
  });

  it('createDictionaryPort exposes isValid and getRandomFragment', async () => {
    const { loadDictionary, createDictionaryPort } = await importFresh();
    await loadDictionary();
    const port = createDictionaryPort();
    expect(port.isValid('AA')).toBe(true);
    const fragment = port.getRandomFragment(1);
    expect([2, 3]).toContain(fragment.length);
  });
});
