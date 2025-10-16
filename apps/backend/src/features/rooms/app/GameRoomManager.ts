import { GameRoom } from '@game/domain/rooms/GameRoom';
import { GameRoomRules } from '@game/domain/rooms/GameRoomRules';
import { getLogger } from '@platform/logging/context';

/**
 * Coordinates lifecycle operations for in-memory {@link GameRoom} instances.
 *
 * The manager is a simple wrapper on top of a {@link Map} that ensures
 * room-level logging and encapsulates creation, lookup, and cleanup logic
 * for game rooms owned by the backend process.
 */
export class GameRoomManager {
  private readonly rooms = new Map<string, GameRoom>();

  /**
   * Retrieves a previously created room.
   *
   * @param code Unique room identifier provided by the client.
   * @returns The matching room when present; otherwise `undefined`.
   */
  get(code: string): GameRoom | undefined {
    return this.rooms.get(code);
  }

  /**
   * Checks whether a room exists for the supplied code.
   *
   * @param code Unique room identifier provided by the client.
   * @returns `true` if the room exists; otherwise `false`.
   */
  has(code: string): boolean {
    return this.rooms.has(code);
  }

  /**
   * Deletes a room and emits an audit log when the room existed.
   *
   * @param code Unique room identifier provided by the client.
   * @returns `true` when a room was removed; otherwise `false`.
   */
  delete(code: string): boolean {
    const deleted = this.rooms.delete(code);
    if (deleted) {
      getLogger().info(
        { event: 'room_deleted', gameId: code },
        'Game room deleted',
      );
    }
    return deleted;
  }

  /**
   * Creates a new room and registers it in the manager.
   *
   * @param code Unique room identifier provided by the client or generator.
   * @param rules Game rules payload used to initialise the room.
   * @param name Optional display name supplied by the client.
   * @returns The newly created {@link GameRoom} instance.
   * @throws {Error} When a room for the given code already exists.
   */
  create(code: string, rules: GameRoomRules, name?: string): GameRoom {
    if (this.rooms.has(code)) {
      throw new Error(`Room ${code} already exists`);
    }

    const room = new GameRoom({ code }, rules);
    if (typeof name === 'string') {
      room.name = name;
    }
    this.rooms.set(code, room);
    getLogger().info(
      { event: 'game_created', gameId: code },
      'Game room created',
    );
    return room;
  }

  /**
   * Lists players that are currently seated in the referenced room.
   *
   * @param code Unique room identifier provided by the client.
   * @returns Array of seated players or an empty array when the room is absent.
   */
  getSeatedPlayers(code: string) {
    const room = this.rooms.get(code);
    return room ? room.getAllPlayers().filter((p) => p.isSeated) : [];
  }

  /**
   * Removes every tracked room. Intended for test isolation only.
   */
  clear(): void {
    const count = this.rooms.size;
    this.rooms.clear();
    if (count > 0) {
      getLogger().debug(
        { event: 'rooms_cleared', count },
        'Cleared game rooms',
      );
    }
  }
}
