import { GameRoomManager } from '../../rooms/app/GameRoomManager';

/**
 * Shared {@link GameRoomManager} instance used across request handlers and socket code.
 */
export const roomManager = new GameRoomManager();
