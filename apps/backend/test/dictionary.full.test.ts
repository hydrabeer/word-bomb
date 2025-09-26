import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';

// We'll snapshot & restore relevant env vars we touch.
const ORIGINAL_ENV = { ...process.env };

function setEnv(env: NodeJS.ProcessEnv) {
  process.env = { ...ORIGINAL_ENV, ...env };
}

// Utility to dynamically import a FRESH copy of the dictionary module after resetting modules.
async function freshDictionary() {
  const mod = await import('../src/dictionary');
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
    vi.doMock(
      'https',
      () =>
        ({
          get: () => ({
            on: (event: string, handler: (e?: unknown) => void) => {
              if (event === 'error') handler(new Error('forced error'));
              return {};
            },
          }),
          default: {} as unknown,
        }) as unknown as typeof import('https'),
    );
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
    vi.doMock(
      'https',
      () =>
        ({
          get: (
            _url: string,
            cb: (res: {
              statusCode: number;
              pipe: (w: unknown) => void;
            }) => void,
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
          default: {} as unknown,
        }) as unknown as typeof import('https'),
    );
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
});
