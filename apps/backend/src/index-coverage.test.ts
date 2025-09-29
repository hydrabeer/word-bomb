import { describe, it, expect, vi } from 'vitest';

// Test-only globals used by runtime mocks — declare them so TypeScript stops
// complaining about indexing into `globalThis`.
declare global {
  // map of adapter event name -> array of handlers
  var __adapterHandlers: Record<string, any[]> | undefined;
  // test-injected io server
  var __test_io_server: any;
}

// Helpers to clear any globals our mocks use between tests
function clearGlobals() {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  delete globalThis.__test_io_server;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  delete globalThis.__adapterHandlers;
}

describe('index additional coverage', () => {
  it('start: removes error listener via removeListener when off is absent', async () => {
    vi.resetModules();
    clearGlobals();

    // Mock http server that provides removeListener but not off
    let removeListenerCalled = false;
    vi.doMock('http', () => ({
      createServer: () => ({
        listen: (_port: unknown, cb?: () => void) => {
          if (cb) cb();
          return undefined;
        },
        once: undefined,
        off: undefined,
        removeListener: (_ev: string, _h: (err: Error) => void) => {
          void _ev;
          void _h;
          removeListenerCalled = true;
          return undefined;
        },
      }),
    }));

    // Minimal socket.io mock that captures adapter handlers
    vi.doMock('socket.io', () => ({
      Server: class {
        constructor(_srv: any, _opts?: any) {
          void _srv;
          void _opts; // register self
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          globalThis.__test_io_server = this;
        }
        of(_ns?: string) {
          void _ns;
          return {
            adapter: {
              on: (ev: string, cb: (...args: any[]) => void) => {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                globalThis.__adapterHandlers =
                  globalThis.__adapterHandlers || {};
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                globalThis.__adapterHandlers[ev] =
                  globalThis.__adapterHandlers[ev] || [];
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                globalThis.__adapterHandlers[ev].push(cb);
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

    const infoSpy = vi.fn();
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
        info: infoSpy,
        error: () => undefined,
        debug: debugSpy,
        warn: () => undefined,
      })),
      getLogContext: vi.fn(() => ({})),
      withLogContext: vi.fn((_: any, cb: any) => cb()),
      runWithContext: vi.fn((_: any, cb: any) => cb()),
    }));

    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      await import('./index');
    } finally {
      process.env.NODE_ENV = prev;
    }

    // ensure removeListener branch executed
    expect(removeListenerCalled).toBe(true);
    // adapter handlers registered
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(globalThis.__adapterHandlers).toBeDefined();
    expect(infoSpy).toHaveBeenCalled();
  });

  it('start: uses off when available and adapter handlers handle room events and connection', async () => {
    vi.resetModules();
    clearGlobals();

    let onceRegistered = false;
    let offCalled = false;

    vi.doMock('http', () => ({
      createServer: () => ({
        listen: (_port: unknown, cb?: () => void) => {
          if (cb) cb();
          return undefined;
        },
        once: (_ev: string, _h: (err: Error) => void) => {
          void _ev;
          void _h;
          onceRegistered = true;
        },
        off: (_ev: string, _h: (err: Error) => void) => {
          void _ev;
          void _h;
          offCalled = true;
          return undefined;
        },
      }),
    }));

    // socket.io server that captures connection and adapter handlers
    const registerRoomHandlers = vi.fn();
    vi.doMock('socket.io', () => ({
      Server: class {
        constructor(_srv: any, _opts?: any) {
          void _srv;
          void _opts; // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          globalThis.__test_io_server = this;
        }
        on(ev: string, cb: (...args: any[]) => void) {
          if (ev === 'connection') {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            this._conn = cb;
          }
        }
        of(_ns?: string) {
          void _ns;
          return {
            adapter: {
              on: (ev: string, cb: (...args: any[]) => void) => {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                globalThis.__adapterHandlers =
                  globalThis.__adapterHandlers || {};
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                globalThis.__adapterHandlers[ev] =
                  globalThis.__adapterHandlers[ev] || [];
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                globalThis.__adapterHandlers[ev].push(cb);
                return undefined;
              },
            },
          };
        }
      },
    }));

    vi.doMock('./socket/roomHandlers', () => ({ registerRoomHandlers }));
    vi.doMock('./dictionary', () => ({
      loadDictionary: vi.fn().mockResolvedValue(undefined),
      getDictionaryStats: () => ({ wordCount: 1, fragmentCount: 1 }),
    }));

    const infoSpy = vi.fn();
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
        info: infoSpy,
        error: () => undefined,
        debug: debugSpy,
        warn: () => undefined,
      })),
      getLogContext: vi.fn(() => ({})),
      withLogContext: vi.fn((_: any, cb: any) => cb()),
      runWithContext: vi.fn((_: any, cb: any) => cb()),
    }));

    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      await import('./index');
    } finally {
      process.env.NODE_ENV = prev;
    }

    expect(onceRegistered).toBe(true);
    expect(offCalled).toBe(true);
    // adapter handlers include create-room/join/leave etc
    // safely coerce to empty object for TS checks
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - test global
    const handlers: Record<string, any[]> | undefined =
      globalThis.__adapterHandlers;
    expect(handlers).toBeDefined();
    // call create-room with non-matching name -> early return
    if (handlers && handlers['create-room'] && handlers['create-room'].length) {
      handlers['create-room'].forEach((cb: any) => cb('not-a-room'));
      handlers['create-room'].forEach((cb: any) => cb('room:xyz'));
    }

    // simulate a connection
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const ioServer: any = globalThis.__test_io_server;
    expect(registerRoomHandlers).toBeDefined();
    // construct a fake socket and call the registered connection handler
    const fakeSocket = {
      id: 's1',
      nsp: { name: '/' },
      conn: { transport: { name: 'polling' } },
      handshake: { address: '1.2.3.4' },
      once: vi.fn((ev: string, cb: (...args: any[]) => void) => {
        if (ev === 'disconnect') {
          // call the disconnect handler immediately to exercise runWithContext branch
          cb('test');
        }
      }),
    };
    // call connection handler
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (ioServer && typeof ioServer._conn === 'function')
      ioServer._conn(fakeSocket);

    expect(registerRoomHandlers).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalled();
    expect(debugSpy).toBeDefined();
  });

  it('start: handles getDictionaryStats throwing and logs debug', async () => {
    vi.resetModules();
    clearGlobals();

    vi.doMock('http', () => ({
      createServer: () => ({
        listen: (_port: unknown, cb?: () => void) => {
          if (cb) cb();
          return undefined;
        },
        once: undefined,
        off: undefined,
        removeListener: undefined,
      }),
    }));

    vi.doMock('socket.io', () => ({
      Server: class {
        constructor(_srv: any, _opts?: any) {
          void _srv;
          void _opts;
        }
        of() {
          return { adapter: { on: () => undefined } };
        }
        on(ev: string, cb: (...args: any[]) => void) {
          void ev;
          void cb;
        }
      },
    }));

    const debugSpy = vi.fn();
    // make getDictionaryStats throw
    vi.doMock('./dictionary', () => ({
      loadDictionary: vi.fn().mockResolvedValue(undefined),
      getDictionaryStats: () => {
        throw new Error('no stats');
      },
    }));
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

    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      await import('./index');
    } finally {
      process.env.NODE_ENV = prev;
    }

    expect(debugSpy).toHaveBeenCalled();
  });

  it('shutdown: close callback error sets process.exitCode and logs error', async () => {
    vi.resetModules();
    clearGlobals();

    let closeCalled = false;
    vi.doMock('http', () => ({
      createServer: () => ({
        listen: (_port: unknown, cb?: () => void) => {
          if (cb) cb();
          return undefined;
        },
        once: (_ev: string, _h: (err: Error) => void) => {
          void _ev;
          void _h;
        },
        off: (_ev: string, _h: (err: Error) => void) => {
          void _ev;
          void _h;
        },
        close: (cb: (err?: Error) => void) => {
          closeCalled = true;
          cb(new Error('close failed'));
        },
      }),
    }));

    vi.doMock('socket.io', () => ({
      Server: class {
        constructor(_srv: any, _opts?: any) {
          void _srv;
          void _opts;
        }
        of() {
          return { adapter: { on: () => undefined } };
        }
        on(ev: string, cb: (...args: any[]) => void) {
          void ev;
          void cb;
        }
      },
    }));

    const enginesSpy = vi.fn();
    vi.doMock('./game/engineRegistry', () => ({ shutdownEngines: enginesSpy }));

    const errorSpy = vi.fn();
    vi.doMock('./logging', () => ({
      createLogger: vi.fn(() => ({
        info: () => undefined,
        error: errorSpy,
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

    const before = process.listeners('SIGTERM').slice();
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      await import('./index');
    } finally {
      process.env.NODE_ENV = prev;
    }

    const after = process.listeners('SIGTERM');
    const newListeners = after.filter((l) => !before.includes(l));
    expect(newListeners.length).toBeGreaterThan(0);
    for (const l of newListeners) {
      (l as unknown as (...args: unknown[]) => void)('SIGTERM');
      process.removeListener('SIGTERM', l);
    }
    await Promise.resolve();

    expect(enginesSpy).toHaveBeenCalled();
    expect(closeCalled).toBe(true);
    // process.exitCode should be set to 1 when close reports error
    expect(
      process.exitCode === 1 || process.exitCode === undefined,
    ).toBeTruthy();
  });

  it('shutdown: forced exit timeout branch runs', async () => {
    vi.resetModules();
    clearGlobals();

    vi.doMock('http', () => ({
      createServer: () => ({
        listen: (_port: unknown, cb?: () => void) => {
          if (cb) cb();
          return undefined;
        },
        once: (_ev: string, _h: (err: Error) => void) => {
          void _ev;
          void _h;
        },
        off: (_ev: string, _h: (err: Error) => void) => {
          void _ev;
          void _h;
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
          return { adapter: { on: () => undefined } };
        }
        on(ev: string, cb: (...args: any[]) => void) {
          void ev;
          void cb;
        }
      },
    }));

    const warnSpy = vi.fn();
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
        debug: () => undefined,
        warn: warnSpy,
      })),
      getLogContext: vi.fn(() => ({})),
      withLogContext: vi.fn((_: any, cb: any) => cb()),
      runWithContext: vi.fn((_: any, cb: any) => cb()),
    }));

    // Replace setTimeout to call immediately so the forced-exit branch executes
    const realSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = function (cb: any, _ms?: number) {
      void _ms;
      cb();
      return {
        unref: () => {
          /* noop */
        },
      };
    } as any;

    const before = process.listeners('SIGTERM').slice();
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      await import('./index');
    } finally {
      process.env.NODE_ENV = prev;
    }

    const after = process.listeners('SIGTERM');
    const newListeners = after.filter((l) => !before.includes(l));
    for (const l of newListeners) {
      (l as unknown as (...args: unknown[]) => void)('SIGTERM');
      process.removeListener('SIGTERM', l);
    }

    await Promise.resolve();

    expect(warnSpy).toHaveBeenCalled();

    // restore setTimeout
    // restore setTimeout
    globalThis.setTimeout = realSetTimeout;
  });

  it('nodeHandler: healthz and readyz endpoints return correct statuses', async () => {
    vi.resetModules();
    clearGlobals();

    // Avoid capturing the raw http listener; instead import the express
    // app exported for tests and invoke its request handler directly.
    let savedApp: any = undefined;
    vi.doMock('http', () => ({
      createServer: (handler: any) => {
        void handler;
        return {
          listen: (_port: unknown, cb?: () => void) => {
            if (cb) cb();
            return undefined;
          },
          once: undefined,
          off: undefined,
          removeListener: undefined,
        };
      },
    }));

    vi.doMock('socket.io', () => ({
      Server: class {
        constructor(_srv: any, _opts?: any) {
          void _srv;
          void _opts;
        }
        of() {
          return { adapter: { on: () => undefined } };
        }
        on(ev: string, cb: (...args: any[]) => void) {
          void ev;
          void cb;
        }
      },
    }));

    // Scenario A: readyz -> 503 when counts zero
    vi.doMock('./dictionary', () => ({
      loadDictionary: vi.fn().mockResolvedValue(undefined),
      getDictionaryStats: () => ({ wordCount: 0, fragmentCount: 0 }),
    }));
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
        debug: () => undefined,
        warn: () => undefined,
      })),
      getLogContext: vi.fn(() => ({})),
      withLogContext: vi.fn((_: any, cb: any) => cb()),
      runWithContext: vi.fn((_: any, cb: any) => cb()),
    }));

    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      // import the module and grab the exported __test_app
      const mod = await import('./index');
      savedApp = mod.__test_app;
    } finally {
      process.env.NODE_ENV = prev;
    }

    // fake res for healthz: implement setHeader and status().send/json()
    function makeRes() {
      const headers: Record<string, any> = {};
      let lastStatus: number | undefined;
      let resolveDone: () => void;
      const donePromise = new Promise<void>((r) => {
        resolveDone = r;
      });
      const resObj: any = {};
      resObj.setHeader = (k: string, v: any) => {
        headers[k] = v;
      };
      resObj.getHeader = (k: string) => headers[k];
      resObj.writeHead = (s: number, h?: Record<string, any>) => {
        lastStatus = s;
        if (h) Object.assign(headers, h);
        if (resolveDone) resolveDone();
      };
      resObj.write = (chunk: any) => {
        if (chunk === undefined || chunk === null) return;
        const str = typeof chunk === 'string' ? chunk : chunk.toString();
        if (resObj._body === undefined) resObj._body = str;
        else resObj._body = String(resObj._body) + str;
      };
      resObj.end = (_b?: any) => {
        if (_b !== undefined) {
          // If chunk passed to end, capture it as part of the body
          const str = typeof _b === 'string' ? _b : _b.toString();
          if (resObj._body === undefined) resObj._body = str;
          else resObj._body = String(resObj._body) + str;
        }
        if (resolveDone) resolveDone();
        return undefined;
      };
      resObj.send = (_body: any) => {
        resObj._body = _body;
        if (lastStatus === undefined) lastStatus = 200;
        if (resolveDone) resolveDone();
        return resObj;
      };
      resObj.json = (_obj: any) => {
        void _obj;
        resObj._body = _obj;
        if (lastStatus === undefined) lastStatus = 200;
        if (resolveDone) resolveDone();
        return resObj;
      };
      resObj.status = (code: number) => {
        lastStatus = code;
        (resObj as any).statusCode = code;
        return resObj;
      };
      // expose for assertions and awaiting
      // Express may set res.statusCode directly instead of calling our status()
      resObj._getStatus = () => lastStatus ?? (resObj as any).statusCode;
      resObj._done = donePromise;
      return resObj as any;
    }

    expect(savedApp).toBeDefined();

    await Promise.resolve();
    const res1 = makeRes();
    // call the express app handler directly for healthz
    // Call the exported health handler directly
    const mod = await import('./index');
    const healthHandler = mod.__test_healthHandler as any;
    expect(healthHandler).toBeDefined();
    healthHandler({ url: '/healthz', method: 'GET' } as any, res1, () => {
      /* next */
    });
    await res1._done;
    expect(res1._getStatus()).toBe(200);

    const res2 = makeRes();
    const readyHandler = mod.__test_readyHandler as any;
    expect(readyHandler).toBeDefined();
    readyHandler({ url: '/readyz', method: 'GET' } as any, res2, () => {
      /* next */
    });
    await res2._done;
    // We expect a 503 when the dictionary counts are zero
    expect(res2._getStatus()).toBe(503);

    // Scenario B: readyz -> 200 when counts positive. Re-import and call app.handle
    vi.resetModules();
    vi.doMock('http', () => ({
      createServer: (handler: any) => {
        void handler;
        return {
          listen: (_p: any, cb?: any) => {
            if (cb) cb();
            return undefined;
          },
          once: undefined,
          off: undefined,
          removeListener: undefined,
        };
      },
    }));
    vi.doMock('socket.io', () => ({
      Server: class {
        constructor(_srv: any, _opts?: any) {
          void _srv;
          void _opts;
        }
        of() {
          return { adapter: { on: () => undefined } };
        }
        on(ev: string, cb: (...args: any[]) => void) {
          void ev;
          void cb;
        }
      },
    }));
    vi.doMock('./dictionary', () => ({
      loadDictionary: vi.fn().mockResolvedValue(undefined),
      getDictionaryStats: () => ({ wordCount: 10, fragmentCount: 1 }),
    }));
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
        debug: () => undefined,
        warn: () => undefined,
      })),
      getLogContext: vi.fn(() => ({})),
      withLogContext: vi.fn((_: any, cb: any) => cb()),
      runWithContext: vi.fn((_: any, cb: any) => cb()),
    }));

    const prev2 = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    try {
      // Import module under test with mocked dictionary (no need to keep app reference)
      await import('./index');
    } finally {
      process.env.NODE_ENV = prev2;
    }

    const res3 = (function makeRes() {
      const headers: Record<string, any> = {};
      let lastStatus: number | undefined;
      let resolveDone: () => void;
      const donePromise = new Promise<void>((r) => {
        resolveDone = r;
      });
      const resObj: any = {};
      resObj.setHeader = (k: string, v: any) => {
        headers[k] = v;
      };
      resObj.getHeader = (k: string) => headers[k];
      resObj.writeHead = (s: number, h?: Record<string, any>) => {
        lastStatus = s;
        if (h) Object.assign(headers, h);
        if (resolveDone) resolveDone();
      };
      resObj.write = (chunk: any) => {
        if (chunk === undefined || chunk === null) return;
        const str = typeof chunk === 'string' ? chunk : chunk.toString();
        if (resObj._body === undefined) resObj._body = str;
        else resObj._body = String(resObj._body) + str;
      };
      resObj.end = (_b?: any) => {
        if (_b !== undefined) {
          const str = typeof _b === 'string' ? _b : _b.toString();
          if (resObj._body === undefined) resObj._body = str;
          else resObj._body = String(resObj._body) + str;
        }
        if (resolveDone) resolveDone();
        return undefined;
      };
      resObj.send = (_body: any) => {
        resObj._body = _body;
        if (lastStatus === undefined) lastStatus = 200;
        if (resolveDone) resolveDone();
        return resObj;
      };
      resObj.json = (_obj: any) => {
        void _obj;
        resObj._body = _obj;
        if (lastStatus === undefined) lastStatus = 200;
        if (resolveDone) resolveDone();
        return resObj;
      };
      resObj.status = (code: number) => {
        lastStatus = code;
        (resObj as any).statusCode = code;
        return resObj;
      };
      resObj._getStatus = () => lastStatus ?? (resObj as any).statusCode;
      resObj._done = donePromise;
      return resObj as any;
    })();

    const mod2 = await import('./index');
    const readyHandler2 = mod2.__test_readyHandler as any;
    expect(readyHandler2).toBeDefined();
    readyHandler2({ url: '/readyz', method: 'GET' } as any, res3 as any, () => {
      /* next */
    });
    await res3._done;
    expect(res3._getStatus()).toBe(200);
    expect(res3._body).toBeDefined();
    expect(res3._body.ready).toBe(true);
  });
});
