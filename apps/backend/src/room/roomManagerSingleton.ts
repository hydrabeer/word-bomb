import { GameRoomManager } from './GameRoomManager';

/**
 * Shared {@link GameRoomManager} instance used across request handlers and socket code.
 */
export const roomManager = new GameRoomManager();
