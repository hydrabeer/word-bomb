import { AsyncLocalStorage } from 'node:async_hooks';
import pino from 'pino';
import type { Logger } from 'pino';

type CorrelationKeys = 'reqId' | 'connId' | 'gameId' | 'playerId';

export type LogContext = {
  logger: Logger;
} & Partial<Record<CorrelationKeys, string>>;

const storage = new AsyncLocalStorage<LogContext>();
const silentLogger = pino({ level: 'silent' });
let rootContext: LogContext = { logger: silentLogger };

export function initializeLoggerContext(logger: Logger): void {
  rootContext = { logger };
  storage.enterWith(rootContext);
}

function currentContext(): LogContext {
  return storage.getStore() ?? rootContext;
}

export function getLogContext(): LogContext {
  return currentContext();
}

export function getLogger(): Logger {
  return currentContext().logger;
}

type LogBindings = Partial<Record<CorrelationKeys, string>>;

export function withLogContext<T>(bindings: LogBindings, fn: () => T): T {
  const parent = currentContext();
  const nextLogger = parent.logger.child(bindings);
  const nextContext: LogContext = {
    ...parent,
    ...bindings,
    logger: nextLogger,
  };
  return storage.run(nextContext, fn);
}

export function childLogger(bindings: LogBindings): Logger | null {
  const ctx = storage.getStore();
  if (!ctx) return null;
  const nextLogger = ctx.logger.child(bindings);
  Object.assign(ctx, bindings);
  ctx.logger = nextLogger;
  return nextLogger;
}

export function runWithContext<T>(context: LogContext, fn: () => T): T {
  return storage.run(context, fn);
}
