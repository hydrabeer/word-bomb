import type { GameEngine } from './GameEngine';

const engines = new Map<string, GameEngine>();

export const gameEngines = {
  set: (roomCode: string, engine: GameEngine) => {
    engines.set(roomCode, engine);
  },
  get: (roomCode: string) => engines.get(roomCode),
  delete: (roomCode: string) => {
    engines.delete(roomCode);
  },
  clear: () => {
    engines.clear();
  },
};

export const setGameEngine = gameEngines.set;
export const getGameEngine = gameEngines.get;

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
