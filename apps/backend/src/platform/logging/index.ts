import pino, {
  type DestinationStream,
  type LoggerOptions,
  type Bindings,
  type SerializerFn,
} from 'pino';

/**
 * Pino redact path expressions that ensure sensitive values do not reach log sinks.
 */
const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'cookie',
  'authorization',
  'email',
  'user.email',
] as const;

/**
 * Produces the timestamp fragment appended to each log line.
 *
 * @returns A JSON fragment containing an ISO-8601 timestamp.
 */
const timestamp = () => `,"ts":"${new Date().toISOString()}"`;

// Keep the implementation strongly typed to avoid returning `any`.
/**
 * Converts thrown values into serializable objects compatible with Pino's error serializer.
 *
 * @param err - Value provided to the logger under the `err` key.
 * @returns A plain object describing the error, or the original value if it is not an `Error`.
 */
const serializeError = (err: unknown): unknown => {
  if (!(err instanceof Error)) return err;
  return {
    type: err.name,
    message: err.message,
    stack: err.stack,
  };
};

/**
 * Determines the application version reported in log records.
 *
 * @returns The version derived from environment metadata or a safe fallback.
 */
const resolveVersion = () =>
  process.env.npm_package_version ?? process.env.APP_VERSION ?? '0.0.0';

/**
 * Options that control how {@link createLogger} sets up the root logger instance.
 */
export interface CreateLoggerOptions {
  service?: string;
  destination?: DestinationStream;
}

/**
 * Creates a configured Pino logger that standardizes metadata, redaction, and timestamp behavior.
 *
 * @param serviceOrOptions - Service name string or options bag including `service` and `destination`.
 * @param maybeDestination - Destination stream used when the first argument is a service name.
 * @returns A Pino logger ready for application-wide use.
 */
export function createLogger(
  serviceOrOptions?: string | CreateLoggerOptions,
  maybeDestination?: DestinationStream,
) {
  const service =
    typeof serviceOrOptions === 'string'
      ? serviceOrOptions
      : (serviceOrOptions?.service ?? 'backend');
  const destination =
    typeof serviceOrOptions === 'object'
      ? serviceOrOptions.destination
      : maybeDestination;

  const version = resolveVersion();
  const options: LoggerOptions = {
    level: process.env.LOG_LEVEL ?? 'info',
    base: {
      service,
      version,
      pid: process.pid,
    },
    timestamp,
    formatters: {
      level(label) {
        return { level: label };
      },
      bindings(bindings: Bindings) {
        return {
          service,
          version,
          pid: typeof bindings.pid === 'number' ? bindings.pid : process.pid,
        };
      },
      log(object) {
        return object;
      },
    },
    redact: {
      paths: [...redactPaths],
      censor: '[REDACTED]',
    },
    serializers: {
      // Cast to Pino's SerializerFn to satisfy the interface
      err: serializeError as SerializerFn,
    },
    messageKey: 'msg',
  } satisfies LoggerOptions;

  return pino(options, destination);
}

export type { Logger } from 'pino';
