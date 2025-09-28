import { createServer } from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { afterAll, beforeAll } from 'vitest';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@word-bomb/types/socket';
import { io as Client, Socket } from 'socket.io-client';
import { registerRoomHandlers } from '../src/socket/roomHandlers';
import type { TypedServer, TypedSocket } from '../src/socket/typedSocket';

export interface TestContext {
  io: TypedServer;
  httpServer: ReturnType<typeof createServer>;
  url: string;
  // Socket.IO client generics: <ServerToClientEvents, ClientToServerEvents>
  createClient: () => Socket<ServerToClientEvents, ClientToServerEvents>;
  close: () => Promise<void>;
}

export async function setupTestServer(): Promise<TestContext> {
  const app = express();
  // Wrap express app so the listener has a strict void return (discard possible Promise from Express 5 async handling)
  const httpServer = createServer((req, res) => {
    void app(req, res);
  }); // sync creation
  const io: TypedServer = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    never,
    SocketData
  >(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket: TypedSocket) => {
    // Ensure no Promise is returned to the event emitter
    registerRoomHandlers(io, socket);
  });

  await new Promise<void>((resolve, reject) => {
    function handleError(error: Error) {
      httpServer.off('listening', handleListening);
      reject(error);
    }

    function handleListening() {
      httpServer.off('error', handleError);
      resolve();
    }

    httpServer.once('error', handleError);
    httpServer.once('listening', handleListening);
    httpServer.listen(0, '127.0.0.1');
  });

  const address = httpServer.address();
  if (address === null || typeof address !== 'object') {
    await new Promise<void>((resolve) => {
      httpServer.close(() => {
        resolve();
      });
    });
    throw new Error('Failed to obtain test server address');
  }
  const url = `http://127.0.0.1:${String(address.port)}`;

  function createClient(): Socket<ServerToClientEvents, ClientToServerEvents> {
    return Client(url, {
      autoConnect: true,
      forceNew: true,
      reconnection: false,
      // Prefer WebSocket directly to avoid HTTP long-polling upgrade overhead in tests
      transports: ['websocket'],
      timeout: 2000,
    });
  }

  async function close(): Promise<void> {
    // Be defensive: ensure Socket.IO closes, but don't fail the shutdown if already closed
    io.removeAllListeners();
    try {
      await new Promise<void>((resolve) => {
        // io.close does not error; callback fires when done
        void io.close(() => {
          resolve();
        });
      });
    } catch {
      // ignore
    }

    // If HTTP server was never started or already closed, avoid rejecting with ERR_SERVER_NOT_RUNNING
    if (!httpServer.listening) {
      return; // nothing to do
    }
    await new Promise<void>((resolve) => {
      httpServer.close(() => {
        resolve();
      });
    });
  }

  return { io, httpServer, url, createClient, close };
}

export function withServer(): () => TestContext {
  let ctx: TestContext | undefined;
  beforeAll(async () => {
    ctx = await setupTestServer();
  });
  afterAll(async () => {
    if (ctx) {
      await ctx.close();
      ctx = undefined;
    }
  });
  return () => {
    if (!ctx) {
      throw new Error('Test server not initialized');
    }
    return ctx;
  };
}
