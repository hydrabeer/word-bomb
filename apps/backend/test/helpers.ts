import { createServer } from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { afterAll, beforeAll } from 'vitest';
import type { AddressInfo } from 'net';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@word-bomb/types';
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

export function setupTestServer(): TestContext {
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

  httpServer.listen();
  const address = httpServer.address() as AddressInfo;
  const url = `http://localhost:${String(address.port)}`;

  function createClient(): Socket<ServerToClientEvents, ClientToServerEvents> {
    return Client(url, {
      autoConnect: true,
      forceNew: true,
      reconnection: false,
    });
  }

  async function close() {
    io.removeAllListeners();
    await new Promise<void>((resolve) => {
      void io.close(() => {
        resolve();
      });
    });
    httpServer.close();
  }

  return { io, httpServer, url, createClient, close };
}

export function withServer(): () => TestContext {
  let ctx: TestContext; // assigned in beforeAll
  beforeAll(() => {
    ctx = setupTestServer();
  });
  afterAll(async () => {
    return ctx.close();
  });
  return () => ctx;
}
