import type { GameEngine } from './GameEngine';

const engines = new Map<string, GameEngine>();

/**
 * In-memory registry of active game engines keyed by room code.
 *
 * @remarks
 * This is a transient process-wide store; callers must ensure single-threaded access.
 */
export const gameEngines = {
  /**
   * Registers or replaces the engine associated with a room.
   *
   * @param roomCode - Identifier for the room the engine belongs to.
   * @param engine - The instantiated {@link GameEngine}.
   */
  set: (roomCode: string, engine: GameEngine) => {
    engines.set(roomCode, engine);
  },
  /**
   * Retrieves the engine currently bound to the provided room code.
   *
   * @param roomCode - Identifier of the room to look up.
   * @returns The {@link GameEngine} if one is registered, otherwise `undefined`.
   */
  get: (roomCode: string) => engines.get(roomCode),
  /**
   * Removes the engine associated with the given room.
   *
   * @param roomCode - Identifier for the room to disassociate.
   */
  delete: (roomCode: string) => {
    engines.delete(roomCode);
  },
  /**
   * Clears all tracked engines.
   */
  clear: () => {
    engines.clear();
  },
};

/** Shortcut to {@link gameEngines.set}. */
export const setGameEngine = gameEngines.set;
/** Shortcut to {@link gameEngines.get}. */
export const getGameEngine = gameEngines.get;
/** Shortcut to {@link gameEngines.delete}. */
export const deleteGameEngine = gameEngines.delete;

/**
 * Clears scheduled timers on all registered engines, then clears the registry.
 * Useful for graceful shutdown to avoid keeping the event loop alive.
 */
export function shutdownEngines() {
  for (const engine of engines.values()) {
    try {
      engine.clearTimeout();
    } catch {
      // ignore
    }
  }
  engines.clear();
}
