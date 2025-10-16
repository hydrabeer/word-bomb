import type { TypedSocket } from '@platform/socket/typedSocket';
import { createSocketDataAccessor } from '@platform/socket/data/socketDataAccessor';

/**
 * Manages per-socket session metadata such as the current room and player id.
 */
export class SocketSession {
  private readonly roomCodeAccessor;
  private readonly playerIdAccessor;

  /**
   * Creates a new session wrapper for the provided socket connection.
   *
   * @param socket - Active socket whose metadata should be managed.
   */
  constructor(private readonly socket: TypedSocket) {
    this.roomCodeAccessor = createSocketDataAccessor(
      socket,
      'currentRoomCode',
      (value): value is string => typeof value === 'string',
    );
    this.playerIdAccessor = createSocketDataAccessor(
      socket,
      'currentPlayerId',
      (value): value is string => typeof value === 'string',
    );
  }

  /**
   * Retrieves the room code currently associated with the socket.
   */
  getRoomCode(): string | undefined {
    return this.roomCodeAccessor.get();
  }

  /**
   * Persists the provided room code on the socket session.
   *
   * @param code - Identifier of the room now associated with this player.
   */
  setRoomCode(code: string): void {
    this.roomCodeAccessor.set(code);
  }

  /**
   * Removes the stored room code for the session.
   */
  clearRoomCode(): void {
    this.roomCodeAccessor.clear();
  }

  /**
   * Retrieves the player id linked to the socket session.
   */
  getPlayerId(): string | undefined {
    return this.playerIdAccessor.get();
  }

  /**
   * Stores the provided player id on the session.
   *
   * @param playerId - Identifier of the player controlling the socket.
   */
  setPlayerId(playerId: string): void {
    this.playerIdAccessor.set(playerId);
  }

  /**
   * Clears the player id stored on the session.
   */
  clearPlayerId(): void {
    this.playerIdAccessor.clear();
  }

  /**
   * Clears both room and player data for the session.
   */
  reset(): void {
    this.clearRoomCode();
    this.clearPlayerId();
  }
}
