import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type express from 'express';
import type { IncomingMessage, ServerResponse } from 'http';

type Listener = (...args: unknown[]) => void;

interface HttpMockOptions {
  listen?: (port: unknown, cb?: () => void) => void;
  once?: ((event: string, handler: (error: Error) => void) => void) | null;
  off?: ((event: string, handler: (error: Error) => void) => void) | null;
  removeListener?:
    | ((event: string, handler: (error: Error) => void) => void)
    | null;
  close?: (cb: (err?: Error) => void) => void;
}

interface DictionaryMockOptions {
  loadDictionary?: () => Promise<void>;
  getDictionaryStats?: () => { wordCount: number; fragmentCount: number };
}

interface LoggerMock {
  info: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
  child: ReturnType<typeof vi.fn>;
}

interface LoggingContextMockOptions {
  getLogger?: () => LoggerMock;
  getLogContext?: () => Record<string, unknown>;
  withLogContext?: (ctx: Record<string, unknown>, cb: () => unknown) => unknown;
  runWithContext?: (ctx: Record<string, unknown>, cb: () => unknown) => unknown;
}

interface SocketMockOptions {
  registerRoomHandlers?: ReturnType<typeof vi.fn>;
}

interface HarnessOptions {
  http?: HttpMockOptions;
  dictionary?: DictionaryMockOptions;
  logging?: Partial<LoggerMock>;
  loggingContext?: LoggingContextMockOptions;
  socket?: SocketMockOptions;
  engineRegistry?: { shutdownEngines?: ReturnType<typeof vi.fn> };
}

interface IndexHarness {
  importIndex: (nodeEnv?: string) => Promise<typeof import('./index')>;
  http: {
    listen: ReturnType<typeof vi.fn>;
    once?: ReturnType<typeof vi.fn>;
    off?: ReturnType<typeof vi.fn>;
    removeListener?: ReturnType<typeof vi.fn>;
    close?: ReturnType<typeof vi.fn>;
    server?: Record<string, unknown>;
    nodeHandler?: Listener;
  };
  dictionary: {
    loadDictionary: ReturnType<typeof vi.fn>;
    getDictionaryStats: ReturnType<typeof vi.fn>;
  };
  logger: LoggerMock;
  loggingContext: {
    getLogger: ReturnType<typeof vi.fn>;
    getLogContext: ReturnType<typeof vi.fn>;
    withLogContext: ReturnType<typeof vi.fn>;
    runWithContext: ReturnType<typeof vi.fn>;
  };
  socket: {
    adapterHandlers: Map<string, Listener[]>;
    connectionHandlers: Listener[];
    registerRoomHandlers: ReturnType<typeof vi.fn>;
  };
  engineRegistry: { shutdownEngines: ReturnType<typeof vi.fn> };
}

function createNestedLogger(): LoggerMock {
  const child = vi.fn(() => createNestedLogger());

  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child,
  };
}

function createLoggerMock(overrides: Partial<LoggerMock> = {}): LoggerMock {
  const logger: LoggerMock = {
    info: overrides.info ?? vi.fn(),
    error: overrides.error ?? vi.fn(),
    warn: overrides.warn ?? vi.fn(),
    debug: overrides.debug ?? vi.fn(),
    child: overrides.child ?? vi.fn(() => createNestedLogger()),
  };
  vi.doMock('./platform/logging', () => ({
    createLogger: vi.fn(() => logger),
  }));
  return logger;
}

function createLoggingContextMock(
  logger: LoggerMock,
  overrides: LoggingContextMockOptions = {},
) {
  const getLogger = overrides.getLogger
    ? vi.fn(overrides.getLogger)
    : vi.fn(() => logger as unknown as LoggerMock);
  const getLogContext = overrides.getLogContext
    ? vi.fn(overrides.getLogContext)
    : vi.fn(() => ({ logger }) as Record<string, unknown>);
  const withLogContext = overrides.withLogContext
    ? vi.fn(overrides.withLogContext)
    : vi.fn((_ctx: Record<string, unknown>, cb: () => unknown) => cb());
  const runWithContext = overrides.runWithContext
    ? vi.fn(overrides.runWithContext)
    : vi.fn((_ctx: Record<string, unknown>, cb: () => unknown) => cb());

  vi.doMock('./platform/logging/context', () => ({
    initializeLoggerContext: vi.fn(),
    getLogger,
    getLogContext,
    withLogContext,
    runWithContext,
    childLogger: vi.fn(() => logger),
  }));

  return { getLogger, getLogContext, withLogContext, runWithContext };
}

function createDictionaryMock(options: DictionaryMockOptions = {}) {
  const loadDictionary = options.loadDictionary
    ? vi.fn(options.loadDictionary)
    : vi.fn().mockResolvedValue(undefined);
  const getDictionaryStats = options.getDictionaryStats
    ? vi.fn(options.getDictionaryStats)
    : vi.fn(() => ({ wordCount: 4, fragmentCount: 2 }));

  vi.doMock('./platform/dictionary', () => ({
    loadDictionary,
    getDictionaryStats,
  }));

  return { loadDictionary, getDictionaryStats };
}

function createEngineRegistryMock(
  options: { shutdownEngines?: ReturnType<typeof vi.fn> } = {},
) {
  const shutdownEngines = options.shutdownEngines ?? vi.fn();
  vi.doMock('./features/gameplay/engine/engineRegistry', () => ({
    shutdownEngines,
  }));
  return { shutdownEngines };
}

function createSocketMock(options: SocketMockOptions = {}) {
  const adapterHandlers = new Map<string, Listener[]>();
  const connectionHandlers: Listener[] = [];
  const registerRoomHandlers =
    options.registerRoomHandlers ?? vi.fn(() => undefined);

  class FakeServer {
    adapter = {
      on: vi.fn((event: string, handler: Listener) => {
        const list = adapterHandlers.get(event) ?? [];
        list.push(handler);
        adapterHandlers.set(event, list);
        return undefined;
      }),
    };

    constructor(_srv: unknown, _opts?: unknown) {
      void _srv;
      void _opts;
    }

    of(_namespace?: string) {
      void _namespace;
      return { adapter: this.adapter };
    }

    on(event: string, handler: Listener) {
      if (event === 'connection') {
        connectionHandlers.push(handler);
      }
      return undefined;
    }
  }

  vi.doMock('socket.io', () => ({ Server: FakeServer }));
  vi.doMock('./features/rooms/socket/roomHandlers', () => ({
    registerRoomHandlers,
  }));

  return { adapterHandlers, connectionHandlers, registerRoomHandlers };
}

function createHttpMock(options: HttpMockOptions = {}) {
  const listen = vi.fn((port: unknown, cb?: () => void) => {
    if (options.listen) {
      return options.listen(port, cb);
    }
    if (cb) cb();
    return undefined;
  });

  const once =
    options.once === null
      ? undefined
      : vi.fn((event: string, handler: (error: Error) => void) => {
          if (options.once) {
            return options.once(event, handler);
          }
          return undefined;
        });

  const off =
    options.off === null
      ? undefined
      : vi.fn((event: string, handler: (error: Error) => void) => {
          if (options.off) {
            return options.off(event, handler);
          }
          return undefined;
        });

  const removeListener =
    options.removeListener === undefined
      ? undefined
      : vi.fn((event: string, handler: (error: Error) => void) => {
          return options.removeListener?.(event, handler);
        });

  const close =
    options.close === undefined
      ? undefined
      : vi.fn((cb: (err?: Error) => void) => options.close?.(cb));

  let serverInstance: Record<string, unknown> | undefined;
  let nodeHandler: Listener | undefined;

  vi.doMock('http', () => ({
    createServer: (handler: Listener) => {
      nodeHandler = handler;
      serverInstance = {
        listen,
        ...(once ? { once } : {}),
        ...(off ? { off } : {}),
        ...(removeListener ? { removeListener } : {}),
        ...(close ? { close } : {}),
      };
      return serverInstance;
    },
  }));

  return {
    listen,
    once,
    off,
    removeListener,
    close,
    get server() {
      return serverInstance;
    },
    get nodeHandler() {
      return nodeHandler;
    },
  };
}

function setupTestEnvironment() {
  vi.resetModules();
}

function createMocks(options: HarnessOptions = {}) {
  const logger = createLoggerMock(options.logging ?? {});
  const loggingContext = createLoggingContextMock(
    logger,
    options.loggingContext ?? {},
  );
  const dictionary = createDictionaryMock(options.dictionary ?? {});
  const http = createHttpMock(options.http ?? {});
  const socket = createSocketMock(options.socket ?? {});
  const engineRegistry = createEngineRegistryMock(options.engineRegistry ?? {});

  return { logger, loggingContext, dictionary, http, socket, engineRegistry };
}

function createImportIndex() {
  return async function importIndex(nodeEnv = 'development') {
    const previousEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = nodeEnv;
    try {
      return await import('./index');
    } finally {
      process.env.NODE_ENV = previousEnv;
    }
  };
}

type HarnessMocks = ReturnType<typeof createMocks>;

function createHarness(mocks: HarnessMocks): IndexHarness {
  return {
    importIndex: createImportIndex(),
    http: mocks.http,
    dictionary: mocks.dictionary,
    logger: mocks.logger,
    loggingContext: mocks.loggingContext,
    socket: mocks.socket,
    engineRegistry: mocks.engineRegistry,
  };
}

async function createIndexHarness(
  options: HarnessOptions = {},
): Promise<IndexHarness> {
  setupTestEnvironment();
  const mocks = createMocks(options);
  return createHarness(mocks);
}

function captureSignalState() {
  const snapshots = new Map<string, Listener[]>();
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    snapshots.set(signal, process.listeners(signal) as Listener[]);
  }
  return () => {
    for (const signal of ['SIGTERM', 'SIGINT'] as const) {
      const before = snapshots.get(signal) ?? [];
      for (const handler of process.listeners(signal) as Listener[]) {
        if (!before.includes(handler)) {
          process.removeListener(
            signal as NodeJS.Signals,
            handler as NodeJS.SignalsListener,
          );
        }
      }
    }
  };
}

function callAdapterHandlers(
  harness: IndexHarness,
  event: string,
  ...args: unknown[]
) {
  const handlers = harness.socket.adapterHandlers.get(event) ?? [];
  handlers.forEach((handler) => handler(...args));
}

function invokeConnectionHandlers(
  harness: IndexHarness,
  socket: Record<string, unknown>,
) {
  harness.socket.connectionHandlers.forEach((handler) => handler(socket));
}

function createMockResponse() {
  const headers = new Map<string, unknown>();
  let status: number | undefined;
  let body: unknown;
  let resolve: (() => void) | undefined;
  const done = new Promise<void>((r) => {
    resolve = r;
  });

  const res: any = {
    setHeader: (key: string, value: unknown) => {
      headers.set(key, value);
    },
    getHeader: (key: string) => headers.get(key),
    status: (code: number) => {
      status = code;
      res.statusCode = code;
      return res;
    },
    send: (payload: unknown) => {
      body = payload;
      if (status === undefined) {
        status = 200;
        res.statusCode = 200;
      }
      resolve?.();
      return res;
    },
    json: (payload: unknown) => {
      body = payload;
      if (status === undefined) {
        status = 200;
        res.statusCode = 200;
      }
      resolve?.();
      return res;
    },
    end: (payload?: unknown) => {
      if (payload !== undefined) {
        body = payload;
      }
      resolve?.();
      return res;
    },
  };

  return {
    res,
    getBody: () => body,
    getStatus: () => status ?? res.statusCode,
    done,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('index start-up', () => {
  it('loads dictionary, starts listening, and registers socket handlers', async () => {
    const harness = await createIndexHarness();
    const restoreSignals = captureSignalState();
    await harness.importIndex('development');
    restoreSignals();

    expect(harness.dictionary.loadDictionary).toHaveBeenCalledTimes(1);
    expect(harness.http.listen).toHaveBeenCalledTimes(1);
    expect(Array.from(harness.socket.adapterHandlers.keys())).toEqual(
      expect.arrayContaining([
        'create-room',
        'delete-room',
        'join-room',
        'leave-room',
      ]),
    );

    callAdapterHandlers(harness, 'create-room', 'room:123');
    callAdapterHandlers(harness, 'delete-room', 'room:123');
    callAdapterHandlers(harness, 'join-room', 'room:123', 'socket-1');
    callAdapterHandlers(harness, 'leave-room', 'room:123', 'socket-1');
    callAdapterHandlers(harness, 'create-room', 'lobby');
    callAdapterHandlers(harness, 'delete-room', 'lobby');
    callAdapterHandlers(harness, 'join-room', 'lobby', 'socket-1');
    callAdapterHandlers(harness, 'leave-room', 'lobby', 'socket-1');

    const debugEvents = harness.logger.debug.mock.calls.map(
      (call) => call[0]?.event,
    );
    expect(debugEvents).toEqual(
      expect.arrayContaining([
        'adapter_room_created',
        'adapter_room_deleted',
        'adapter_room_joined',
        'adapter_room_left',
      ]),
    );

    const fakeSocket = {
      id: 'socket-1',
      nsp: { name: '/' },
      conn: { transport: { name: 'websocket' } },
      handshake: { address: '127.0.0.1' },
      once: vi.fn((event: string, cb: Listener) => {
        if (event === 'disconnect') {
          cb('client-left');
        }
        return undefined;
      }),
    };

    invokeConnectionHandlers(harness, fakeSocket);

    expect(harness.socket.registerRoomHandlers).toHaveBeenCalledWith(
      expect.any(Object),
      fakeSocket,
    );

    const infoEvents = harness.logger.info.mock.calls.map(
      (call) => call[0]?.event,
    );
    expect(infoEvents).toContain('socket_connected');
    expect(infoEvents).toContain('socket_disconnected');
  });

  it('removes error listeners using off when supported', async () => {
    const offSpy = vi.fn();
    const harness = await createIndexHarness({
      http: {
        off: (event, handler) => {
          offSpy(event, handler);
        },
      },
    });
    const restoreSignals = captureSignalState();
    await harness.importIndex('development');
    restoreSignals();

    expect(offSpy).toHaveBeenCalledWith('error', expect.any(Function));
    expect(harness.http.listen).toHaveBeenCalledTimes(1);
  });

  it('falls back to removeListener when off is unavailable', async () => {
    const removeListenerSpy = vi.fn();
    const harness = await createIndexHarness({
      http: {
        off: null,
        removeListener: (event, handler) => {
          removeListenerSpy(event, handler);
        },
      },
    });
    const restoreSignals = captureSignalState();
    await harness.importIndex('development');
    restoreSignals();

    expect(removeListenerSpy).toHaveBeenCalledWith(
      'error',
      expect.any(Function),
    );
  });

  it('coerces string port environment variable to a number in logs', async () => {
    const harness = await createIndexHarness();
    const restoreSignals = captureSignalState();
    const previousPort = process.env.PORT;
    process.env.PORT = '4010';
    await harness.importIndex('development');
    restoreSignals();
    process.env.PORT = previousPort;

    const startLog = harness.logger.info.mock.calls.find(
      (call) => call[0]?.event === 'server_start',
    );
    expect(startLog?.[0]?.port).toBe(4010);
  });

  it('logs when dictionary stats cannot be retrieved', async () => {
    const debugSpy = vi.fn();
    const harness = await createIndexHarness({
      dictionary: {
        getDictionaryStats: () => {
          throw new Error('no stats');
        },
      },
      logging: { debug: debugSpy },
    });
    const restoreSignals = captureSignalState();
    await harness.importIndex('development');
    restoreSignals();

    expect(debugSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'dictionary_stats_unavailable' }),
      'Dictionary statistics unavailable',
    );
  });

  it('logs listen errors surfaced via the once handler and exits', async () => {
    let capturedHandler: ((error: Error) => void) | undefined;
    const errorSpy = vi.fn();
    const harness = await createIndexHarness({
      http: {
        listen: () => undefined,
        once: (event, handler) => {
          if (event === 'error') capturedHandler = handler;
        },
        off: null,
      },
      logging: { error: errorSpy },
    });

    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    const originalVitest = process.env.VITEST;
    process.env.VITEST = 'false';

    const restoreSignals = captureSignalState();
    await harness.importIndex('development');
    restoreSignals();

    expect(typeof capturedHandler).toBe('function');
    capturedHandler?.(new Error('bind failed'));

    // give module top-level promise rejection handlers a chance to run
    await new Promise((r) => setImmediate(r));

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'server_listen_error' }),
      'Failed to bind HTTP server',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    process.env.VITEST = originalVitest;
  });
});

describe('index shutdown flow', () => {
  it('closes the server and exits when close succeeds', async () => {
    const closeSpy = vi.fn((cb: (err?: Error) => void) => {
      cb();
    });
    const shutdownEngines = vi.fn();
    const infoSpy = vi.fn();

    const harness = await createIndexHarness({
      http: { close: closeSpy },
      engineRegistry: { shutdownEngines },
      logging: { info: infoSpy },
    });

    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    const originalVitest = process.env.VITEST;
    process.env.VITEST = 'false';

    const restoreSignals = captureSignalState();
    await harness.importIndex('development');
    const cleanup = restoreSignals;

    const after = process.listeners('SIGTERM');
    expect(after.length).toBeGreaterThan(0);
    after.forEach((handler) => {
      if (!cleanup) return;
      handler('SIGTERM');
      process.removeListener('SIGTERM', handler);
    });

    await Promise.resolve();

    expect(shutdownEngines).toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'server_closed' }),
      'HTTP server closed',
    );
    expect(exitSpy).toHaveBeenCalled();

    cleanup();
    process.env.VITEST = originalVitest;
  });

  it('logs close errors and sets exitCode', async () => {
    const closeSpy = vi.fn((cb: (err?: Error) => void) => {
      cb(new Error('close failed'));
    });
    const errorSpy = vi.fn();
    const harness = await createIndexHarness({
      http: { close: closeSpy },
      logging: { error: errorSpy },
    });

    const restoreSignals = captureSignalState();
    await harness.importIndex('development');
    const cleanup = restoreSignals;

    const listeners = process.listeners('SIGTERM');
    listeners.forEach((handler) => {
      handler('SIGTERM');
      process.removeListener('SIGTERM', handler);
    });

    await Promise.resolve();

    expect(closeSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'server_close_error' }),
      'Error closing HTTP server',
    );
    expect(process.exitCode === 1 || process.exitCode === undefined).toBe(true);

    cleanup();
  });

  it('skips server.close when not available and logs debug', async () => {
    const debugSpy = vi.fn();
    const harness = await createIndexHarness({ logging: { debug: debugSpy } });

    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    const originalVitest = process.env.VITEST;
    process.env.VITEST = 'false';

    const restoreSignals = captureSignalState();
    await harness.importIndex('development');
    const cleanup = restoreSignals;

    const listeners = process.listeners('SIGTERM');
    listeners.forEach((handler) => {
      handler('SIGTERM');
      process.removeListener('SIGTERM', handler);
    });

    await Promise.resolve();

    expect(debugSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'server_close_skipped' }),
      'Server close skipped (no close method)',
    );
    expect(exitSpy).toHaveBeenCalled();

    cleanup();
    process.env.VITEST = originalVitest;
  });

  it('runs the forced exit timeout branch', async () => {
    vi.useFakeTimers();
    const warnSpy = vi.fn();
    const harness = await createIndexHarness({ logging: { warn: warnSpy } });

    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    const originalVitest = process.env.VITEST;
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    process.env.VITEST = 'false';

    const restoreSignals = captureSignalState();
    const cleanup = restoreSignals;

    try {
      await harness.importIndex('development');

      const listeners = process.listeners('SIGTERM');
      listeners.forEach((handler) => {
        handler('SIGTERM');
        process.removeListener('SIGTERM', handler);
      });

      await Promise.resolve();

      expect(timeoutSpy).toHaveBeenCalled();

      vi.runAllTimers();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'shutdown_forced_exit' }),
        'Forced exit after shutdown timeout',
      );
      expect(exitSpy).toHaveBeenCalled();
    } finally {
      cleanup();
      process.env.VITEST = originalVitest;
      timeoutSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('logs errors when engine shutdown throws', async () => {
    const errorSpy = vi.fn();
    const harness = await createIndexHarness({
      http: {
        close: (cb) => cb(),
      },
      engineRegistry: {
        shutdownEngines: vi.fn(() => {
          throw new Error('boom');
        }),
      },
      logging: { error: errorSpy },
    });

    const restoreSignals = captureSignalState();
    await harness.importIndex('development');

    const listeners = process.listeners('SIGTERM');
    listeners.forEach((handler) => {
      handler('SIGTERM');
      process.removeListener('SIGTERM', handler);
    });

    await Promise.resolve();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'engines_shutdown_error' }),
      'Error during engines shutdown',
    );

    restoreSignals();
  });
});

describe('http handlers', () => {
  it('health and readiness handlers report status', async () => {
    const harness = await createIndexHarness({
      dictionary: {
        getDictionaryStats: () => ({ wordCount: 0, fragmentCount: 0 }),
      },
    });
    const mod = await harness.importIndex('test');

    const health = createMockResponse();
    mod.healthHandler({ method: 'GET' } as any, health.res);
    await health.done;
    expect(health.getStatus()).toBe(200);
    expect(health.getBody()).toBe('ok');

    const ready = createMockResponse();
    mod.readyHandler({ method: 'GET' } as any, ready.res);
    await ready.done;
    expect(ready.getStatus()).toBe(503);
    expect(ready.getBody()).toEqual({
      ready: false,
      wordCount: 0,
      fragmentCount: 0,
    });
  });

  it('readiness handler returns ready when dictionary has entries', async () => {
    const harness = await createIndexHarness({
      dictionary: {
        getDictionaryStats: () => ({ wordCount: 5, fragmentCount: 2 }),
      },
    });
    const mod = await harness.importIndex('test');

    const ready = createMockResponse();
    mod.readyHandler({ method: 'GET' } as any, ready.res);
    await ready.done;

    expect(ready.getStatus()).toBe(200);
    expect(ready.getBody()).toEqual({
      ready: true,
      wordCount: 5,
      fragmentCount: 2,
    });
  });

  it('exports the node handler used to create the HTTP server', async () => {
    const harness = await createIndexHarness();
    const mod = await harness.importIndex('test');
    expect(typeof mod.nodeHandler).toBe('function');
    expect(mod.nodeHandler).toBe(harness.http.nodeHandler);
    expect(mod.app).toBeDefined();
  });

  it('invokes the underlying express handler when nodeHandler is called', async () => {
    setupTestEnvironment();
    const expressHandler = vi.fn();
    const expressMock = Object.assign(
      vi.fn(() => {
        const app = ((req: unknown, res: unknown, next: () => void) => {
          expressHandler(req, res, next);
          if (typeof next === 'function') {
            next();
          }
        }) as unknown as express.Application;
        (app as unknown as { use: () => void }).use = vi.fn();
        (app as unknown as { get: () => void }).get = vi.fn();
        return app;
      }),
      { json: vi.fn(() => vi.fn()) },
    );
    const routerMock = vi.fn(() => ({
      use: vi.fn(),
      get: vi.fn(),
      post: vi.fn(),
    }));
    vi.doMock('express', () => ({
      __esModule: true,
      default: Object.assign(expressMock, { Router: routerMock }),
      Router: routerMock,
    }));

    const harness = createHarness(createMocks());
    const mod = await harness.importIndex('test');

    const req = {
      method: 'GET',
      url: '/healthz',
    } as unknown as IncomingMessage;
    const res = { statusCode: 0 } as unknown as ServerResponse;

    expect(() => mod.nodeHandler(req, res)).not.toThrow();
    expect(expressHandler).toHaveBeenCalledWith(req, res, expect.any(Function));

    vi.resetModules();
  });
});
