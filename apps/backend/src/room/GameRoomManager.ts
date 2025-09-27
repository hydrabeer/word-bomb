import { GameRoom, GameRoomRules } from '@game/domain';

export class GameRoomManager {
  private readonly rooms = new Map<string, GameRoom>();

  get(code: string): GameRoom | undefined {
    return this.rooms.get(code);
  }

  has(code: string): boolean {
    return this.rooms.has(code);
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
    this.rooms.clear();
  }
}
