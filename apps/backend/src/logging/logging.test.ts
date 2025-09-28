import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createLogger } from '.';

describe('structured logger', () => {
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
});
