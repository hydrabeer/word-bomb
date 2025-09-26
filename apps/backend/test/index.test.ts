import { describe, it, expect, vi } from 'vitest';

// Hoisted mocks: use local factories only referencing variables defined inside factory
const loadDictionaryMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../src/dictionary', () => ({ loadDictionary: loadDictionaryMock }));

// Capture adapter event registrations and connection handler registration
const adapterOn = vi.fn();
const connectionHandler = vi.fn();

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
    const logSpy = vi
      .spyOn(console, 'log')
      .mockImplementation(function logNoop() {
        /* intentionally muted in test */
      });
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
      logSpy.mock.calls.some((c) =>
        String(c[0]).includes('Server running on port'),
      ),
    ).toBe(true);
    logSpy.mockRestore();
  });
});
