import express, {
  type Application,
  type Request,
  type Response,
} from 'express';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
  type RequestListener,
} from 'http';
import { randomUUID } from 'node:crypto';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import roomsRouter from './routes/rooms';
import { registerRoomHandlers } from './socket/roomHandlers';
import { loadDictionary, getDictionaryStats } from './dictionary';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@word-bomb/types/socket';
import { createLogger } from './logging';
import {
  getLogContext,
  getLogger,
  initializeLoggerContext,
  runWithContext,
  withLogContext,
} from './logging/context';

const rootLogger = createLogger('backend');
initializeLoggerContext(rootLogger);

const FRONTEND_ORIGIN = process.env.FRONTEND_URL ?? 'http://localhost:5173';
const SHUTDOWN_FORCE_EXIT_TIMEOUT_MS = 5000;
const DEFAULT_PORT = 3001;

const app: Application = express();
// Use helmet to set security headers
app.use(
  helmet({
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
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: 'deny' }, // X-Frame-Options: DENY
  }),
);
app.use(cors());

// Sets up an API endpoint for creating and joining rooms
app.use(express.json());
app.use('/api/rooms', roomsRouter);

// Lightweight health and readiness endpoints
export const healthHandler = (_req: Request, res: Response) => {
  res.status(200).send('ok');
};

export const readyHandler = (_req: Request, res: Response) => {
  const stats = getDictionaryStats();
  const ready = stats.wordCount > 0 && stats.fragmentCount > 0;
  res.status(ready ? 200 : 503).json({ ready, ...stats });
};

app.get('/healthz', healthHandler);
app.get('/readyz', readyHandler);

// Adapter: Express app signature is (req, res, next). Node's createServer expects (req, res).
// Provide a no-op next function so the handler satisfies both signatures.
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

// Sets up the Socket.IO server. CORS (Cross-Origin Resource Sharing) just
// lets our backend and our frontend talk to each other from different domains
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  never,
  SocketData
>(server, {
  cors: {
    origin: FRONTEND_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

/**
 * Loads the dictionary for validating word submissions and make the server
 * listen on the given port.
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

// When a client connects
io.on('connection', (socket) => {
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

    registerRoomHandlers(io, socket);

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

// Log basic socket events in the main namespace
const defaultNamespaceAdapter = io.of('/').adapter;

defaultNamespaceAdapter.on('create-room', (room: string) => {
  if (!room.startsWith('room:')) return;
  getLogger().debug(
    { event: 'adapter_room_created', room, namespace: '/' },
    'Socket.IO room created',
  );
});

defaultNamespaceAdapter.on('delete-room', (room: string) => {
  if (!room.startsWith('room:')) return;
  getLogger().debug(
    { event: 'adapter_room_deleted', room, namespace: '/' },
    'Socket.IO room deleted',
  );
});

defaultNamespaceAdapter.on('join-room', (room: string, id: string) => {
  if (!room.startsWith('room:')) return;
  getLogger().debug(
    { event: 'adapter_room_joined', room, socketId: id, namespace: '/' },
    'Socket joined room',
  );
});

defaultNamespaceAdapter.on('leave-room', (room: string, id: string) => {
  if (!room.startsWith('room:')) return;
  getLogger().debug(
    { event: 'adapter_room_left', room, socketId: id, namespace: '/' },
    'Socket left room',
  );
});

// Graceful shutdown: close server and clear game engine timers so process exits fast
import { shutdownEngines } from './game/engineRegistry';

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
