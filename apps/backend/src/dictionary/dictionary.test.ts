import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';

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

  it('production path downloads file (success) exercising downloadDictionaryFile resolve branch', async () => {
    setEnv({
      NODE_ENV: 'production',
      DICTIONARY_URL: 'https://example.com/dict.txt',
    });
    const realFs = await import('fs');
    try {
      realFs.unlinkSync('/tmp/words.txt');
    } catch {
      /* ignore */
    }
    vi.doMock(
      'fs',
      () =>
        ({
          createWriteStream: () => {
            const listeners: Record<string, (() => void)[]> = {};
            return {
              on: (ev: string, cb: () => void) => {
                (listeners[ev] ??= []).push(cb);
                return this;
              },
              emit: (ev: string) => {
                (listeners[ev] ?? []).forEach((cb) => {
                  cb();
                });
                return this;
              },
              close: (cb: () => void) => {
                cb();
              },
            } as unknown as fs.WriteStream;
          },
          readFileSync: (p: string, enc: BufferEncoding) =>
            realFs.readFileSync(p, enc),
          writeFileSync: realFs.writeFileSync.bind(realFs),
          default: {
            createWriteStream: () => {
              const listeners: Record<string, (() => void)[]> = {};
              return {
                on: (ev: string, cb: () => void) => {
                  (listeners[ev] ??= []).push(cb);
                  return this;
                },
                emit: (ev: string) => {
                  (listeners[ev] ?? []).forEach((cb) => {
                    cb();
                  });
                  return this;
                },
                close: (cb: () => void) => {
                  cb();
                },
              } as unknown as fs.WriteStream;
            },
            readFileSync: (p: string, enc: BufferEncoding) =>
              realFs.readFileSync(p, enc),
            writeFileSync: realFs.writeFileSync.bind(realFs),
          },
        }) as unknown as typeof import('fs'),
    );
    vi.doMock(
      'https',
      () =>
        ({
          get: (
            _url: string,
            cb: (res: {
              statusCode: number;
              pipe: (file: fs.WriteStream) => void;
            }) => void,
          ) => {
            const res = {
              statusCode: 200,
              pipe: (file: fs.WriteStream) => {
                realFs.writeFileSync('/tmp/words.txt', 'prodword\nsecond');
                setImmediate(() => {
                  (file as unknown as { emit?: (e: string) => void }).emit?.(
                    'finish',
                  );
                });
              },
            };
            cb(res);
            return { on: () => ({}) };
          },
          default: {
            get: (
              _url: string,
              cb: (res: {
                statusCode: number;
                pipe: (file: fs.WriteStream) => void;
              }) => void,
            ) => {
              const res = {
                statusCode: 200,
                pipe: (file: fs.WriteStream) => {
                  realFs.writeFileSync('/tmp/words.txt', 'prodword\nsecond');
                  setImmediate(() => {
                    (file as unknown as { emit?: (e: string) => void }).emit?.(
                      'finish',
                    );
                  });
                },
              };
              cb(res);
              return { on: () => ({}) };
            },
          },
        }) as unknown as typeof import('https'),
    );
    const { loadDictionary, isValidWord } = await freshDictionary();
    await loadDictionary();
    expect(isValidWord('prodword')).toBe(true);
  });

  it('production path download failure (network error) triggers early return catch block', async () => {
    setEnv({
      NODE_ENV: 'production',
      DICTIONARY_URL: 'https://example.com/dict.txt',
    });

    const readSpy = vi.fn();
    vi.doMock(
      'fs',
      () =>
        ({
          createWriteStream: () => ({
            on: () => ({}),
            emit: () => true,
            close: (cb: () => void) => {
              cb();
            },
          }),
          readFileSync: readSpy,
          default: {
            createWriteStream: () => ({
              on: () => ({}),
              emit: () => true,
              close: (cb: () => void) => {
                cb();
              },
            }),
            readFileSync: readSpy,
          } as unknown,
        }) as unknown as typeof import('fs'),
    );
    const failingHttp = {
      get: () => ({
        on: (event: string, handler: (e?: unknown) => void) => {
          if (event === 'error') handler(new Error('forced error'));
          return {};
        },
      }),
    } satisfies Partial<typeof import('https')>;
    vi.doMock('https', () => ({ ...failingHttp, default: failingHttp }));
    const { loadDictionary } = await freshDictionary();
    await loadDictionary();
    expect(readSpy).not.toHaveBeenCalled();
  });

  it('loads the on-disk dictionary when DICTIONARY_TEST_MODE forces full load', async () => {
    setEnv({ NODE_ENV: 'test', DICTIONARY_TEST_MODE: 'full' });
    const sample = ['apple', 'banana', 'supercalifragilisticexpialidocious'].join('\n');
    const readSpy = vi.fn(() => sample);
    vi.doMock(
      'fs',
      () =>
        ({
          readFileSync: readSpy,
          default: { readFileSync: readSpy },
        }) as unknown as typeof import('fs'),
    );
    const { loadDictionary, isValidWord, getDictionaryStats } = await freshDictionary();
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

  it('handles download responses without a status code', async () => {
    setEnv({
      NODE_ENV: 'production',
      DICTIONARY_URL: 'https://example.com/dict.txt',
    });
    const readSpy = vi.fn();
    vi.doMock(
      'fs',
      () =>
        ({
          createWriteStream: () => ({
            on: () => ({}),
            close: (cb: () => void) => cb(),
          }),
          readFileSync: readSpy,
          default: {
            createWriteStream: () => ({
              on: () => ({}),
              close: (cb: () => void) => cb(),
            }),
            readFileSync: readSpy,
          } as unknown,
        }) as unknown as typeof import('fs'),
    );
    const undefinedStatusHttp = {
      get: (
        _url: string,
        cb: (res: { statusCode?: number; pipe: (w: unknown) => void }) => void,
      ) => {
        const res = {
          statusCode: undefined as number | undefined,
          pipe: () => {
            /* noop */
          },
        };
        cb(res);
        return { on: () => ({}) };
      },
    } satisfies Partial<typeof import('https')>;
    vi.doMock('https', () => ({ ...undefinedStatusHttp, default: undefinedStatusHttp }));
    const { loadDictionary } = await freshDictionary();
    await loadDictionary();
    expect(readSpy).not.toHaveBeenCalled();
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

  it('production path download non-200 status triggers rejection branch', async () => {
    setEnv({
      NODE_ENV: 'production',
      DICTIONARY_URL: 'https://example.com/dict.txt',
    });
    const readSpy = vi.fn();
    vi.doMock(
      'fs',
      () =>
        ({
          createWriteStream: () => ({
            on: () => ({}),
            emit: () => true,
            close: (cb: () => void) => {
              cb();
            },
          }),
          readFileSync: readSpy,
          default: {
            createWriteStream: () => ({
              on: () => ({}),
              emit: () => true,
              close: (cb: () => void) => {
                cb();
              },
            }),
            readFileSync: readSpy,
          } as unknown,
        }) as unknown as typeof import('fs'),
    );
    const fakeHttp = {
      get: (
        _url: string,
        cb: (res: { statusCode: number; pipe: (w: unknown) => void }) => void,
      ) => {
        const res = {
          statusCode: 500,
          pipe: () => {
            /* no-op */
          },
        };
        cb(res);
        return { on: () => ({}) };
      },
    } satisfies Partial<typeof import('https')>;
    vi.doMock('https', () => ({ ...fakeHttp, default: fakeHttp }));
    const { loadDictionary } = await freshDictionary();
    await loadDictionary();
    expect(readSpy).not.toHaveBeenCalled();
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
});
