import type { SocketData } from '@word-bomb/types/socket';
import type { TypedSocket } from './typedSocket';

export interface SocketDataAccessor<T> {
  get(): T | undefined;
  set(value: T): void;
  clear(): void;
}

function ensureDataObject(socket: TypedSocket): Record<string, unknown> {
  const current = socket.data as unknown;
  if (!current || typeof current !== 'object') {
    socket.data = {} as SocketData;
  }
  return socket.data as Record<string, unknown>;
}

export function createSocketDataAccessor<T>(
  socket: TypedSocket,
  key: string,
  validate: (value: unknown) => value is T,
): SocketDataAccessor<T> {
  return {
    get: (): T | undefined => {
      const data = socket.data as unknown;
      if (!data || typeof data !== 'object') return undefined;
      const value = (data as Record<string, unknown>)[key];
      return validate(value) ? value : undefined;
    },
    set: (value: T): void => {
      const target = ensureDataObject(socket);
      target[key] = value;
    },
    clear: (): void => {
      const data = socket.data as unknown;
      if (!data || typeof data !== 'object') return;
      Reflect.deleteProperty(data as Record<string, unknown>, key);
    },
  };
}
