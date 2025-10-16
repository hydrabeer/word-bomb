import type { SocketData } from '@word-bomb/types/socket';
import type { TypedSocket } from '../typedSocket';

/**
 * Provides a thin abstraction for interacting with strongly typed values stored
 * on the Socket.IO `socket.data` bag.
 *
 * @typeParam T - The value shape that will be stored and retrieved.
 */
export interface SocketDataAccessor<T> {
  /**
   * Retrieves the current value for the configured key if it passes validation.
   */
  get(): T | undefined;
  /**
   * Persists a new value for the configured key.
   */
  set(value: T): void;
  /**
   * Removes the configured key from the socket data bag.
   */
  clear(): void;
}

/**
 * Ensures the Socket.IO data bag is a mutable object before use.
 *
 * @param socket - The Socket.IO connection being mutated.
 * @returns Guaranteed object reference stored on {@link TypedSocket.data}.
 */
function ensureDataObject(socket: TypedSocket): Record<string, unknown> {
  const current = socket.data as unknown;
  if (!current || typeof current !== 'object') {
    socket.data = {} as SocketData;
  }
  return socket.data as Record<string, unknown>;
}

/**
 * Creates a helper that reads and writes a specific key on the socket data bag.
 *
 * @typeParam T - The value shape that will be stored for the key.
 * @param socket - The socket whose data bag should be accessed.
 * @param key - The property name under which the data will be stored.
 * @param validate - Type guard that confirms retrieved values match {@link T}.
 * @returns Minimal interface for managing the keyed socket data value.
 */
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
