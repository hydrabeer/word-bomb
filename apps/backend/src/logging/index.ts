import pino, {
  type DestinationStream,
  type LoggerOptions,
  type Bindings,
  type SerializerFn,
} from 'pino';

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'cookie',
  'authorization',
  'email',
  'user.email',
] as const;

const timestamp = () => `,"ts":"${new Date().toISOString()}"`;

// Keep the implementation strongly typed to avoid returning `any`.
const serializeError = (err: unknown): unknown => {
  if (!(err instanceof Error)) return err;
  return {
    type: err.name,
    message: err.message,
    stack: err.stack,
  };
};

const resolveVersion = () =>
  process.env.npm_package_version ?? process.env.APP_VERSION ?? '0.0.0';

export interface CreateLoggerOptions {
  service?: string;
  destination?: DestinationStream;
}

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
