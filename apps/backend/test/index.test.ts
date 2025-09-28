import { describe, it, expect, vi } from 'vitest';

// Hoisted mocks: use local factories only referencing variables defined inside factory
const loadDictionaryMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../src/dictionary', () => ({ loadDictionary: loadDictionaryMock }));

// Capture adapter event registrations and connection handler registration
const adapterOn = vi.fn();
const connectionHandler = vi.fn();

const infoSpy = vi.fn();
const loggerMock = {
  info: infoSpy,
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(function child() {
    return loggerMock;
  }),
};

vi.mock('../src/logging', () => ({
  createLogger: vi.fn(() => loggerMock),
}));

vi.mock('../src/logging/context', () => {
  return {
    initializeLoggerContext: vi.fn(),
    getLogger: vi.fn(() => loggerMock),
    getLogContext: vi.fn(() => ({ logger: loggerMock })),
    withLogContext: vi.fn((_, cb: () => unknown) => cb()),
    runWithContext: vi.fn((_, cb: () => unknown) => cb()),
    childLogger: vi.fn(() => loggerMock),
  };
});

vi.mock('socket.io', () => ({
  Server: class {
    adapter = { on: adapterOn };
    of() {
      return { adapter: this.adapter };
    }
    on(event: string, cb: (...args: unknown[]) => void) {
      if (event === 'connection') {
        connectionHandler(cb);
      }
    }
  },
}));

// http mock with listen callback immediate invocation
const listenCalls: unknown[] = [];
vi.mock('http', () => ({
  createServer: () => ({
    listen: (port: unknown, cb?: () => void) => {
      listenCalls.push(port);
      if (cb) cb();
    },
  }),
}));

describe('index bootstrap', () => {
  it('loads dictionary, starts server, registers adapter events', async () => {
    infoSpy.mockClear();
    await import('../src/index');
    await Promise.resolve();
    expect(loadDictionaryMock).toHaveBeenCalledTimes(1);
    expect(listenCalls.length).toBeGreaterThan(0);
    expect(connectionHandler).toHaveBeenCalled();
    const events = adapterOn.mock.calls.map((c) => String(c[0]));
    expect(events).toEqual(
      expect.arrayContaining([
        'create-room',
        'delete-room',
        'join-room',
        'leave-room',
      ]),
    );
    expect(
      infoSpy.mock.calls.some(([payload]) => payload?.event === 'server_ready'),
    ).toBe(true);
  });
});
