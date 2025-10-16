import { AsyncLocalStorage } from 'node:async_hooks';
import pino from 'pino';
import type { Logger } from 'pino';

type CorrelationKeys = 'reqId' | 'connId' | 'gameId' | 'playerId';

/**
 * Logging metadata preserved across asynchronous boundaries for the current execution.
 *
 * @remarks The context always includes a Pino `logger` and may include correlation identifiers.
 */
export type LogContext = {
  logger: Logger;
} & Partial<Record<CorrelationKeys, string>>;

const storage = new AsyncLocalStorage<LogContext>();
const silentLogger = pino({ level: 'silent' });
let rootContext: LogContext = { logger: silentLogger };

/**
 * Seeds the root logging context and makes it the active async-local store entry.
 *
 * @param logger - Root Pino logger used whenever no scoped context is available.
 */
export function initializeLoggerContext(logger: Logger): void {
  rootContext = { logger };
  storage.enterWith(rootContext);
}

function currentContext(): LogContext {
  return storage.getStore() ?? rootContext;
}

/**
 * Retrieves the current async-local logging context, falling back to the root context.
 *
 * @returns The active {@link LogContext} containing the scoped logger and correlation IDs.
 */
export function getLogContext(): LogContext {
  return currentContext();
}

/**
 * Retrieves the logger bound to the current async execution.
 *
 * @returns The scoped Pino logger stored on the active {@link LogContext}.
 */
export function getLogger(): Logger {
  return currentContext().logger;
}

type LogBindings = Partial<Record<CorrelationKeys, string>>;

/**
 * Executes a function with a child logger enriched by the provided correlation bindings.
 *
 * @param bindings - Correlation identifiers to associate with the child logger.
 * @param fn - Callback invoked while the scoped context is active.
 * @returns The value returned from `fn`.
 */
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

/**
 * Mutates the current context to use a child logger enriched with new bindings.
 *
 * @param bindings - Correlation identifiers to apply to the current context.
 * @returns The created child logger, or `null` if no context is active.
 */
export function childLogger(bindings: LogBindings): Logger | null {
  const ctx = storage.getStore();
  if (!ctx) return null;
  const nextLogger = ctx.logger.child(bindings);
  Object.assign(ctx, bindings);
  ctx.logger = nextLogger;
  return nextLogger;
}

/**
 * Runs a function with the provided context treated as the active async-local store entry.
 *
 * @param context - The logging context to install for the duration of `fn`.
 * @param fn - Callback executed with `context` active.
 * @returns The value returned from `fn`.
 */
export function runWithContext<T>(context: LogContext, fn: () => T): T {
  return storage.run(context, fn);
}
