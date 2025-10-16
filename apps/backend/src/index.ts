/**
 * @packageDocumentation
 * Entrypoint for the backend service that wires together Express HTTP routes,
 * Socket.IO realtime communication, and graceful shutdown handling.
 */

import express, {
  type Application,
  type Request,
  type Response,
} from 'express';
import cors from 'cors';
import helmet from 'helmet';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
  type RequestListener,
} from 'http';
import { randomUUID } from 'node:crypto';
import { loadDictionary, getDictionaryStats } from './platform/dictionary';
import { shutdownEngines } from './features/gameplay/engine/engineRegistry';
import { createLogger } from './platform/logging';
import {
  getLogContext,
  getLogger,
  initializeLoggerContext,
  runWithContext,
  withLogContext,
} from './platform/logging/context';
import roomsRouter from './features/rooms/http/rooms';
import { registerRoomHandlers } from './features/rooms/socket/roomHandlers';
import type { TypedServer } from './platform/socket/typedSocket';
import { createTypedServer } from './platform/socket/typedSocket';
import { SOCKET_ROOM_PREFIX } from './shared/utils/socketRoomId';

const SHUTDOWN_FORCE_EXIT_TIMEOUT_MS = 5000;
const DEFAULT_PORT = 3001;
const FRONTEND_ORIGIN = process.env.FRONTEND_URL ?? 'http://localhost:5173';
/** Prefix used for Socket.IO rooms that back active games. */

type HttpServer = ReturnType<typeof createServer>;
type IoServer = TypedServer;
type NamespaceAdapter = ReturnType<IoServer['of']>['adapter'];

/** Shared helmet configuration to enforce consistent security headers. */
const helmetOptions: Parameters<typeof helmet>[0] = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", FRONTEND_ORIGIN],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
};

const rootLogger = createLogger('backend');
initializeLoggerContext(rootLogger);

/**
 * Express handler that reports basic service health for Kubernetes-style probes.
 *
 * @param _req - Incoming HTTP request (ignored).
 * @param res - HTTP response used to send the `200 OK` signal.
 */
export const healthHandler = (_req: Request, res: Response) => {
  res.status(200).send('ok');
};

/**
 * Express handler that surfaces dictionary readiness information for load balancers.
 *
 * @param _req - Incoming HTTP request (ignored).
 * @param res - HTTP response that receives readiness metadata.
 */
export const readyHandler = (_req: Request, res: Response) => {
  const stats = getDictionaryStats();
  const ready = stats.wordCount > 0 && stats.fragmentCount > 0;
  res.status(ready ? 200 : 503).json({ ready, ...stats });
};

/**
 * Builds and configures the Express application with security headers and HTTP routes.
 *
 * @returns A fully configured Express application instance.
 */
function createApp(): Application {
  const expressApp = express();
  expressApp.use(helmet(helmetOptions));
  expressApp.use(cors());
  expressApp.use(express.json());
  expressApp.use('/api/rooms', roomsRouter);
  expressApp.get('/healthz', healthHandler);
  expressApp.get('/readyz', readyHandler);
  return expressApp;
}

const app: Application = createApp();

// Adapter: Express app signature is (req, res, next). Node's createServer expects (req, res).
// Provide a no-op next function so the handler satisfies both signatures.
/**
 * Bridges the Express application into Node's bare HTTP server by providing a `RequestListener`.
 *
 * @param req - Incoming HTTP request emitted by Node's HTTP server.
 * @param res - HTTP response object that Express will write to.
 */
export const nodeHandler: RequestListener = (
  req: IncomingMessage,
  res: ServerResponse,
) => {
  // Cast through unknown to keep strict typing without introducing 'any'.
  (
    app as unknown as (
      req: IncomingMessage,
      res: ServerResponse,
      next: (err?: unknown) => void,
    ) => void
  )(req, res, function next() {
    // Intentionally no-op: Node HTTP server does not use the third argument.
  });
};
const server = createServer(nodeHandler);

createSocketServer(server);

/**
 * Loads the dictionary assets, binds the HTTP server, and announces readiness via logging.
 *
 * @param port - Desired port number or string representation supplied via configuration.
 * @returns A promise that resolves when the HTTP server finishes binding its port.
 */
async function start(port: string | number) {
  const log = getLogger();
  loadDictionary();
  let dictionaryStats: ReturnType<typeof getDictionaryStats> | null = null;
  try {
    dictionaryStats = getDictionaryStats();
  } catch (error) {
    log.debug(
      { event: 'dictionary_stats_unavailable', err: error },
      'Dictionary statistics unavailable',
    );
  }
  log.info(
    {
      event: 'dictionary_loaded',
      wordCount: dictionaryStats?.wordCount,
      fragmentCount: dictionaryStats?.fragmentCount,
    },
    'Dictionary loaded',
  );

  await new Promise<void>((resolve, reject) => {
    const numericPort = typeof port === 'string' ? Number(port) : port;

    const onError = (error: Error) => {
      log.error(
        { event: 'server_listen_error', err: error, port: numericPort },
        'Failed to bind HTTP server',
      );
      reject(error);
    };

    const potentialOnce = (
      server as unknown as {
        once?: (event: string, handler: (error: Error) => void) => void;
      }
    ).once;
    if (typeof potentialOnce === 'function') {
      potentialOnce.call(server, 'error', onError);
    }
    server.listen(port, () => {
      log.info(
        { event: 'server_ready', port: numericPort, transport: 'http' },
        'Server ready',
      );
      const potentialOff = (
        server as unknown as {
          off?: (event: string, handler: (error: Error) => void) => void;
        }
      ).off;
      if (typeof potentialOff === 'function') {
        potentialOff.call(server, 'error', onError);
      } else {
        const removeListener = (
          server as unknown as {
            removeListener?: (
              event: string,
              handler: (error: Error) => void,
            ) => void;
          }
        ).removeListener;
        if (typeof removeListener === 'function') {
          removeListener.call(server, 'error', onError);
        }
      }
      resolve();
    });
  });
}

/**
 * Creates and configures the Socket.IO server atop the existing HTTP transport.
 *
 * @param httpServer - Node HTTP server that will upgrade connections for Socket.IO.
 * @returns A fully wired Socket.IO server instance.
 */
function createSocketServer(httpServer: HttpServer): IoServer {
  const socketServer = createTypedServer(httpServer, {
    cors: {
      origin: FRONTEND_ORIGIN,
      methods: ['GET', 'POST'],
    },
  });

  registerSocketConnectionHandlers(socketServer);
  registerNamespaceLogging(socketServer.of('/').adapter);

  return socketServer;
}

/**
 * Wires connection lifecycle logging and room handlers for new Socket.IO clients.
 *
 * @param socketServer - Socket.IO server used to listen for connections.
 */
function registerSocketConnectionHandlers(socketServer: IoServer): void {
  socketServer.on('connection', (socket) => {
    const connId = randomUUID();
    withLogContext({ connId }, () => {
      const connectionContext = getLogContext();
      const connectionLogger = getLogger();
      connectionLogger.info(
        {
          event: 'socket_connected',
          socketId: socket.id,
          namespace: socket.nsp.name,
          transport: socket.conn.transport.name,
          address: socket.handshake.address,
        },
        'Socket connected',
      );

      registerRoomHandlers(socketServer, socket);

      socket.once('disconnect', (reason) => {
        runWithContext(connectionContext, () => {
          const log = getLogger();
          log.info(
            { event: 'socket_disconnected', socketId: socket.id, reason },
            'Socket disconnected',
          );
        });
      });
    });
  });
}

/**
 * Adds adapter-level logging so server operators can observe room churn.
 *
 * @param adapter - Namespace adapter that exposes room lifecycle events.
 */
function registerNamespaceLogging(adapter: NamespaceAdapter): void {
  adapter.on('create-room', (room: string) => {
    if (!isGameRoom(room)) return;
    getLogger().debug(
      { event: 'adapter_room_created', room, namespace: '/' },
      'Socket.IO room created',
    );
  });

  adapter.on('delete-room', (room: string) => {
    if (!isGameRoom(room)) return;
    getLogger().debug(
      { event: 'adapter_room_deleted', room, namespace: '/' },
      'Socket.IO room deleted',
    );
  });

  adapter.on('join-room', (room: string, id: string) => {
    if (!isGameRoom(room)) return;
    getLogger().debug(
      { event: 'adapter_room_joined', room, socketId: id, namespace: '/' },
      'Socket joined room',
    );
  });

  adapter.on('leave-room', (room: string, id: string) => {
    if (!isGameRoom(room)) return;
    getLogger().debug(
      { event: 'adapter_room_left', room, socketId: id, namespace: '/' },
      'Socket left room',
    );
  });
}

/**
 * Determines whether a Socket.IO room name belongs to the game namespace.
 *
 * @param room - Room identifier emitted by the adapter.
 */
function isGameRoom(room: string): boolean {
  return room.startsWith(SOCKET_ROOM_PREFIX);
}

// Production: use environment variable; Dev: use 3001
const PORT = process.env.PORT ?? DEFAULT_PORT;
const portNumber = typeof PORT === 'string' ? Number(PORT) : PORT;

getLogger().info(
  { event: 'server_start', port: portNumber },
  'Starting Word Bomb backend',
);

// In test environments we avoid calling start() automatically to prevent
// tests from being terminated by process.exit in start()'s catch handler.
if (process.env.NODE_ENV !== 'test') {
  start(PORT).catch((err: unknown) => {
    getLogger().error(
      { event: 'server_start_failed', err, port: portNumber },
      'Failed to start app',
    );
    // During Vitest runs we avoid calling process.exit since the runner treats
    // that as an unexpected termination. Respect VITEST env var set by Vitest.
    if (process.env.VITEST !== 'true') process.exit(1);
  });
}

/**
 * Handles operating system shutdown signals and coordinates a graceful server stop.
 *
 * @param signal - The POSIX signal that triggered the shutdown workflow.
 */
function shutdown(signal: NodeJS.Signals) {
  const log = getLogger();
  log.warn({ event: 'shutdown_signal', signal }, 'Received shutdown signal');
  try {
    shutdownEngines();
    log.info({ event: 'engines_shutdown' }, 'Game engines shut down');
  } catch (error) {
    log.error(
      { event: 'engines_shutdown_error', err: error },
      'Error during engines shutdown',
    );
  }
  const maybeClose = (
    server as unknown as { close?: (cb: (err?: Error) => void) => void }
  ).close;
  if (typeof maybeClose === 'function') {
    maybeClose((err?: Error) => {
      const closeLog = getLogger();
      if (err) {
        closeLog.error(
          { event: 'server_close_error', err },
          'Error closing HTTP server',
        );
        process.exitCode = 1;
      } else {
        closeLog.info({ event: 'server_closed' }, 'HTTP server closed');
      }
      // Avoid calling process.exit during Vitest runs (Vitest detects and
      // reports process.exit even when tests mock it). Respect VITEST env.
      if (process.env.VITEST !== 'true') process.exit();
    });
  } else {
    // In tests, server may be a simple mock without close()
    log.debug(
      { event: 'server_close_skipped' },
      'Server close skipped (no close method)',
    );
    if (process.env.VITEST !== 'true') process.exit();
  }
  // Safety timeout
  setTimeout(() => {
    const timeoutLog = getLogger();
    timeoutLog.warn(
      { event: 'shutdown_forced_exit' },
      'Forced exit after shutdown timeout',
    );
    if (process.env.VITEST !== 'true') process.exit(0);
  }, SHUTDOWN_FORCE_EXIT_TIMEOUT_MS).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { app };
