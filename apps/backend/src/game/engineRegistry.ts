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
