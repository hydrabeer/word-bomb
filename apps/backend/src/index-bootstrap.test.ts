import { describe, it, expect, vi } from 'vitest';

describe('index bootstrap adapter events', () => {
  it('registers and invokes adapter callbacks and connection handler', async () => {
    vi.resetModules();
    // put adapter and connection handlers on globalThis so the mock (which runs in a different
    // module context) can reliably access and push to the same structures.
    const adapterHandlers: Record<string, ((...args: any[]) => void)[]> = ((
      globalThis as any
    ).__test_adapterHandlers = {});
    const connectionHandlers: ((cb: (...args: any[]) => void) => void)[] = ((
      globalThis as any
    ).__test_connectionHandlers = []);

    // Mock socket.io Server
    vi.mock('socket.io', () => {
      return {
        Server: class {
          adapter = {
            on: (event: string, cb: (...args: any[]) => void) => {
              const map: Record<string, ((...args: any[]) => void)[]> = ((
                globalThis as any
              ).__test_adapterHandlers =
                (globalThis as any).__test_adapterHandlers ?? {});
              map[event] = map[event] ?? [];
              map[event].push(cb);
            },
          };
          of() {
            return { adapter: this.adapter };
          }
          on(event: string, cb: (...args: any[]) => void) {
            if (event === 'connection')
              (globalThis as any).__test_connectionHandlers.push(
                (h: (...args: any[]) => void) => h(cb),
              );
          }
        },
      };
    });

    // Mock http server to avoid actual listening
    vi.mock('http', () => ({
      createServer: () => ({
        listen: (port: unknown, cb?: () => void) => {
          if (cb) cb();
        },
        once: (ev: string, h: (err: Error) => void) => {
          void ev;
          void h;
          return undefined;
        },
        off: (ev: string, h: (err: Error) => void) => {
          void ev;
          void h;
          return undefined;
        },
      }),
    }));

    // Mock dictionary to avoid heavy load
    vi.mock('./dictionary', () => ({
      loadDictionary: vi.fn().mockResolvedValue(undefined),
      getDictionaryStats: () => ({ wordCount: 1, fragmentCount: 1 }),
    }));

    // Mock logging to keep silent
    vi.mock('./logging', () => ({
      createLogger: vi.fn(() => ({
        info: () => undefined,
        error: () => undefined,
        warn: () => undefined,
        debug: () => undefined,
        child: () => ({}),
      })),
    }));
    vi.mock('./logging/context', () => ({
      initializeLoggerContext: vi.fn(),
      getLogger: vi.fn(() => ({
        info: () => undefined,
        debug: () => undefined,
        warn: () => undefined,
      })),
      getLogContext: vi.fn(() => ({})),
      withLogContext: vi.fn((_: any, cb: any) => cb()),
      runWithContext: vi.fn((_: any, cb: any) => cb()),
    }));

    // Import the module which should register adapter event handlers
    await import('./index');

    // Ensure adapter handlers were registered
    expect(Object.keys(adapterHandlers).length).toBeGreaterThan(0);

    // Call each handler with a 'room:' name to trigger logging path
    const handlersMap: Record<string, ((...args: any[]) => void)[]> =
      (globalThis as any).__test_adapterHandlers ?? {};
    for (const handlers of Object.values(handlersMap)) {
      for (const h of handlers) {
        h('room:ABC');
        h('NONROOM');
      }
    }

    // Simulate a connection by calling captured connection handlers
    for (const ch of connectionHandlers) {
      ch((socket: any) => {
        // Provide minimal socket shape expected by index listeners
        socket.id = 'SID';
        socket.nsp = { name: '/' };
        socket.conn = { transport: { name: 'websocket' } };
        socket.handshake = { address: '127.0.0.1' };
        socket.once = (e: string, cb: (...args: any[]) => void) => {
          void e;
          void cb;
          return undefined;
        };
      });
    }
  });
});
