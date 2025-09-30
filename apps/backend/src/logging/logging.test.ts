import { PassThrough } from 'node:stream';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { createLogger } from '.';

describe('structured logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('pino');
  });

  it('writes JSON lines with required fields', async () => {
    const stream = new PassThrough();
    stream.setEncoding('utf8');
    let buffer = '';
    stream.on('data', (chunk: string) => {
      buffer += chunk;
    });

    const logger = createLogger({
      service: 'backend-test',
      destination: stream,
    });

    logger.info({ event: 'server_ready' }, 'ready');
    logger.error({ event: 'example_error', err: new Error('boom') }, 'failure');

    if (typeof logger.flush === 'function') {
      logger.flush();
    }

    await new Promise((resolve) => setTimeout(resolve, 0));

    const lines = buffer
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    expect(lines.length).toBeGreaterThan(0);

    for (const line of lines) {
      const parsed = JSON.parse(line);
      expect(typeof parsed.ts).toBe('string');
      expect(['debug', 'info', 'warn', 'error']).toContain(parsed.level);
      expect(parsed.service).toBe('backend-test');
      expect(typeof parsed.pid).toBe('number');
      expect(typeof parsed.event).toBe('string');
      expect(typeof parsed.version).toBe('string');
    }

    const errorLine = lines.find((line) => line.includes('example_error'));
    expect(errorLine).toBeDefined();
    if (errorLine) {
      const parsed = JSON.parse(errorLine);
      expect(parsed.err).toMatchObject({ type: 'Error', message: 'boom' });
    }
  });

  it('accepts shorthand service argument with explicit destination', async () => {
    const stream = new PassThrough();
    stream.setEncoding('utf8');
    const chunks: string[] = [];
    stream.on('data', (chunk: string) => {
      chunks.push(...chunk.split(/\n+/).filter(Boolean));
    });

    const logger = createLogger('shorthand-service', stream);
    logger.info({ event: 'shorthand_test' }, 'hello');
    if (typeof logger.flush === 'function') {
      logger.flush();
    }

    await new Promise((resolve) => setTimeout(resolve, 0));

    const payload = chunks.join('\n');
    expect(payload).toContain('"service":"shorthand-service"');
    expect(payload).toContain('"event":"shorthand_test"');
  });

  it('serializes non-error values without modification', async () => {
    const stream = new PassThrough();
    stream.setEncoding('utf8');
    const lines: string[] = [];
    stream.on('data', (chunk) => {
      lines.push(...chunk.split(/\n+/).filter(Boolean));
    });

    const logger = createLogger({ service: 'backend-test', destination: stream });
    logger.error({ event: 'string_error', err: 'not-an-error' }, 'oops');
    if (typeof logger.flush === 'function') {
      logger.flush();
    }

    await new Promise((resolve) => setTimeout(resolve, 0));

    const parsed = lines.map((line) => JSON.parse(line));
    expect(parsed.some((entry) => entry.err === 'not-an-error')).toBe(true);
  });

  it('uses APP_VERSION when npm_package_version is unavailable', async () => {
    const originalNpmVersion = process.env.npm_package_version;
    const originalAppVersion = process.env.APP_VERSION;
    delete process.env.npm_package_version;
    process.env.APP_VERSION = '9.9.9';

    const stream = new PassThrough();
    stream.setEncoding('utf8');
    const lines: string[] = [];
    stream.on('data', (chunk) => {
      lines.push(...chunk.split(/\n+/).filter(Boolean));
    });

    const logger = createLogger({ service: 'version-test', destination: stream });
    logger.info({ event: 'version_check' }, 'version');
    if (typeof logger.flush === 'function') {
      logger.flush();
    }

    await new Promise((resolve) => setTimeout(resolve, 0));

    const [entry] = lines.map((line) => JSON.parse(line));
    expect(entry.version).toBe('9.9.9');

    if (originalNpmVersion === undefined) {
      delete process.env.npm_package_version;
    } else {
      process.env.npm_package_version = originalNpmVersion;
    }
    if (originalAppVersion === undefined) {
      delete process.env.APP_VERSION;
    } else {
      process.env.APP_VERSION = originalAppVersion;
    }
  });

  it('falls back to backend defaults and coerces bindings pid when missing', async () => {
    const originalNpmVersion = process.env.npm_package_version;
    const originalAppVersion = process.env.APP_VERSION;
    delete process.env.npm_package_version;
    delete process.env.APP_VERSION;

    const calls: any[] = [];
    vi.doMock('pino', () => {
      const mock = vi.fn((options, destination) => {
        calls.push({ options, destination });
        return { options, destination } as const;
      });
      return { default: mock, __esModule: true };
    });

    const { createLogger: freshCreateLogger } = await import('./index');
    const destination = new PassThrough();
    const logger = freshCreateLogger(undefined, destination) as unknown as {
      options: any;
    };
    expect(logger.options.base.service).toBe('backend');
    expect(logger.options.base.version).toBe('0.0.0');
    const formatter = logger.options.formatters.bindings({ service: 'other' });
    expect(formatter.pid).toBe(process.pid);
    const withPid = logger.options.formatters.bindings({ pid: 42 } as any);
    expect(withPid.pid).toBe(42);
    expect(logger.options.formatters.log({ foo: 'bar' })).toEqual({ foo: 'bar' });
    expect(calls).toHaveLength(1);

    if (originalNpmVersion === undefined) {
      delete process.env.npm_package_version;
    } else {
      process.env.npm_package_version = originalNpmVersion;
    }
    if (originalAppVersion === undefined) {
      delete process.env.APP_VERSION;
    } else {
      process.env.APP_VERSION = originalAppVersion;
    }
  });
});
