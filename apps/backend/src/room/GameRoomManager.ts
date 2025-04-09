import { GameRoom } from '@game/domain/rooms/GameRoom';
import { GameRoomRules } from '@game/domain/rooms/GameRoomRules';

export class GameRoomManager {
  private readonly rooms = new Map<string, GameRoom>();

  get(code: string): GameRoom | undefined {
    return this.rooms.get(code);
  }

  has(code: string): boolean {
    return this.rooms.has(code);
  }

  create(code: string, rules: GameRoomRules): GameRoom {
    if (this.rooms.has(code)) {
      throw new Error(`Room ${code} already exists`);
    }

    const room = new GameRoom({ code }, rules);
    this.rooms.set(code, room);
    return room;
  }

  delete(code: string): void {
    this.rooms.delete(code);
  }

  all(): GameRoom[] {
    return [...this.rooms.values()];
  }
}
