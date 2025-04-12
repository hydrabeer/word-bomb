import type { GameEngine } from './GameEngine';

const gameEngines = new Map<string, GameEngine>();

export function setGameEngine(roomCode: string, engine: GameEngine): void {
  gameEngines.set(roomCode, engine);
}

export function getGameEngine(roomCode: string): GameEngine | undefined {
  return gameEngines.get(roomCode);
}

export function deleteGameEngine(roomCode: string): void {
  gameEngines.delete(roomCode);
}
