import { GameRoom } from '@game/domain/rooms/GameRoom';
import { GameRoomRules } from '@game/domain/rooms/GameRoomRules';
import { getLogger } from '../logging/context';

export class GameRoomManager {
  private readonly rooms = new Map<string, GameRoom>();

  get(code: string): GameRoom | undefined {
    return this.rooms.get(code);
  }

  has(code: string): boolean {
    return this.rooms.has(code);
  }

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

  /** Convenience to list seated players without re-filter duplication */
  getSeatedPlayers(code: string) {
    const room = this.rooms.get(code);
    return room ? room.getAllPlayers().filter((p) => p.isSeated) : [];
  }

  /**
   * Removes all rooms. Intended for test isolation only.
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
