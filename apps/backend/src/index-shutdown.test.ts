import { describe, it, expect, vi, afterAll } from 'vitest';

// Prevent any test or module import from actually exiting the process.
const __globalExitSpy = vi
  .spyOn(process, 'exit')
  .mockImplementation(() => undefined as never);

describe('index start and shutdown branches', () => {
  it('logs server_listen_error and exits when listen errors via once handler', async () => {
    vi.resetModules();

    // Capture the error handler registered via server.once
    let registeredErrorHandler: ((err: Error) => void) | undefined;

    // Mock http server so start() registers the once handler but listen never calls back
    vi.doMock('http', () => ({
      createServer: () => ({
        listen: (_port: unknown, _cb?: () => void) => {
          void _port;
          void _cb;
          // do not call ready callback to simulate listen not succeeding
          return undefined;
        },
        once: (_ev: string, h: (err: Error) => void) => {
          void _ev;
          registeredErrorHandler = h;
        },
        off: (_ev: string, _h: (err: Error) => void) => {
          void _ev;
          void _h;
          return undefined;
        },
      }),
    }));

    // Prevent socket.io from constructing a real server which expects an actual
    // http.Server (engine.io calls .listeners etc). Use a lightweight mock.
    vi.doMock('socket.io', () => ({
      Server: class {
        constructor(_srv: any, _opts?: any) {
          void _srv;
          void _opts;
        }
        of() {
          return {
            adapter: {
              on: (ev: string, cb: (...args: any[]) => void) => {
                void ev;
                void cb;
                return undefined;
              },
            },
          };
        }
        on(ev: string, cb: (...args: any[]) => void) {
          void ev;
          void cb;
        }
      },
    }));

    // Mock dictionary to be fast
    vi.doMock('./dictionary', () => ({
      loadDictionary: vi.fn().mockResolvedValue(undefined),
      getDictionaryStats: () => ({ wordCount: 1, fragmentCount: 1 }),
    }));

    // Spy on process.exit so the test doesn't actually exit
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    const errorSpy = vi.fn();
    // Mock logging/context so getLogger() returns our spyful logger
    vi.doMock('./logging', () => ({
      createLogger: vi.fn(() => ({
        info: () => undefined,
        error: () => undefined,
        warn: () => undefined,
        debug: () => undefined,
        child: () => ({}),
      })),
    }));
    vi.doMock('./logging/context', () => ({
      initializeLoggerContext: vi.fn(),
      getLogger: vi.fn(() => ({
        info: () => undefined,
        error: errorSpy,
        debug: () => undefined,
        warn: () => undefined,
      })),
      getLogContext: vi.fn(() => ({})),
      withLogContext: vi.fn((_: any, cb: any) => cb()),
      runWithContext: vi.fn((_: any, cb: any) => cb()),
    }));

    // Import module which triggers start(); start registers once('error', ...)
    // and returns a promise that will reject when we call the registered handler.
    // Temporarily set NODE_ENV so the guarded start() runs during this import.
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      await import('./index');
    } finally {
      process.env.NODE_ENV = prev;
    }

    // Now simulate the listen error via the registered handler
    expect(typeof registeredErrorHandler).toBe('function');
    if (registeredErrorHandler)
      registeredErrorHandler(new Error('bind failed'));

    // allow microtasks to flush
    await Promise.resolve();

    // confirm logger.error was called for server_listen_error
    expect(errorSpy).toHaveBeenCalled();

    exitSpy.mockRestore();
  });

  afterAll(() => {
    __globalExitSpy.mockRestore();
  });

  it('shutdown calls server.close and exits when close exists', async () => {
    vi.resetModules();

    // Mock http server whose listen immediately calls ready cb and has close
    const closeSpy = vi.fn((cb: (err?: Error) => void) => {
      if (cb) cb();
    });
    vi.doMock('http', () => ({
      createServer: () => ({
        listen: (_port: unknown, cb?: () => void) => {
          void _port;
          if (cb) cb();
          return undefined;
        },
        once: (_ev: string, _h: (err: Error) => void) => {
          void _ev;
          void _h;
          return undefined;
        },
        off: (_ev: string, _h: (err: Error) => void) => {
          void _ev;
          void _h;
          return undefined;
        },
        close: closeSpy,
      }),
    }));

    vi.doMock('socket.io', () => ({
      Server: class {
        constructor(_srv: any, _opts?: any) {
          void _srv;
          void _opts;
        }
        of() {
          return {
            adapter: {
              on: (ev: string, cb: (...args: any[]) => void) => {
                void ev;
                void cb;
                return undefined;
              },
            },
          };
        }
        on(ev: string, cb: (...args: any[]) => void) {
          void ev;
          void cb;
        }
      },
    }));

    vi.doMock('./dictionary', () => ({
      loadDictionary: vi.fn().mockResolvedValue(undefined),
      getDictionaryStats: () => ({ wordCount: 1, fragmentCount: 1 }),
    }));

    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    const enginesSpy = vi.fn();
    vi.doMock('./game/engineRegistry', () => ({ shutdownEngines: enginesSpy }));

    const infoSpy = vi.fn();
    vi.doMock('./logging', () => ({
      createLogger: vi.fn(() => ({
        info: () => undefined,
        error: () => undefined,
        warn: () => undefined,
        debug: () => undefined,
        child: () => ({}),
      })),
    }));
    vi.doMock('./logging/context', () => ({
      initializeLoggerContext: vi.fn(),
      getLogger: vi.fn(() => ({
        info: infoSpy,
        error: () => undefined,
        debug: () => undefined,
        warn: () => undefined,
      })),
      getLogContext: vi.fn(() => ({})),
      withLogContext: vi.fn((_: any, cb: any) => cb()),
      runWithContext: vi.fn((_: any, cb: any) => cb()),
    }));

    // Capture existing SIGTERM listeners so we can remove the one added by import
    const before = process.listeners('SIGTERM').slice();

    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      // Import to register handlers
      await import('./index');
    } finally {
      process.env.NODE_ENV = prev;
    }

    // Find and call any newly added SIGTERM handler(s)
    const after = process.listeners('SIGTERM');
    const newListeners = after.filter((l) => !before.includes(l));
    expect(newListeners.length).toBeGreaterThan(0);
    // call all new listeners
    for (const l of newListeners) {
      (l as unknown as (...args: unknown[]) => void)('SIGTERM');
      process.removeListener('SIGTERM', l);
    }

    // allow microtasks to flush
    await Promise.resolve();

    expect(enginesSpy).toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalled();

    exitSpy.mockRestore();
  });

  it('shutdown skips close when server has no close and exits', async () => {
    vi.resetModules();

    // Mock http server without close
    vi.doMock('http', () => ({
      createServer: () => ({
        listen: (_port: unknown, cb?: () => void) => {
          void _port;
          if (cb) cb();
          return undefined;
        },
        once: (_ev: string, _h: (err: Error) => void) => {
          void _ev;
          void _h;
          return undefined;
        },
        off: (_ev: string, _h: (err: Error) => void) => {
          void _ev;
          void _h;
          return undefined;
        },
        // no close
      }),
    }));

    vi.doMock('socket.io', () => ({
      Server: class {
        constructor(_srv: any, _opts?: any) {
          void _srv;
          void _opts;
        }
        of() {
          return {
            adapter: {
              on: (ev: string, cb: (...args: any[]) => void) => {
                void ev;
                void cb;
                return undefined;
              },
            },
          };
        }
        on(ev: string, cb: (...args: any[]) => void) {
          void ev;
          void cb;
        }
      },
    }));

    vi.doMock('./dictionary', () => ({
      loadDictionary: vi.fn().mockResolvedValue(undefined),
      getDictionaryStats: () => ({ wordCount: 1, fragmentCount: 1 }),
    }));

    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    const debugSpy = vi.fn();
    vi.doMock('./logging', () => ({
      createLogger: vi.fn(() => ({
        info: () => undefined,
        error: () => undefined,
        warn: () => undefined,
        debug: () => undefined,
        child: () => ({}),
      })),
    }));
    vi.doMock('./logging/context', () => ({
      initializeLoggerContext: vi.fn(),
      getLogger: vi.fn(() => ({
        info: () => undefined,
        error: () => undefined,
        debug: debugSpy,
        warn: () => undefined,
      })),
      getLogContext: vi.fn(() => ({})),
      withLogContext: vi.fn((_: any, cb: any) => cb()),
      runWithContext: vi.fn((_: any, cb: any) => cb()),
    }));

    const before2 = process.listeners('SIGTERM').slice();
    const prev2 = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      await import('./index');
    } finally {
      process.env.NODE_ENV = prev2;
    }
    const after2 = process.listeners('SIGTERM');
    const newListeners2 = after2.filter((l) => !before2.includes(l));
    for (const l of newListeners2) {
      (l as unknown as (...args: unknown[]) => void)('SIGTERM');
      process.removeListener('SIGTERM', l);
    }

    await Promise.resolve();

    expect(debugSpy).toHaveBeenCalled();

    exitSpy.mockRestore();
  });
});
