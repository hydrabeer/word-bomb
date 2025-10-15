import type { TypedSocket } from './typedSocket';
import { createSocketDataAccessor } from './socketDataAccessor';

export class SocketSession {
  private readonly roomCodeAccessor;
  private readonly playerIdAccessor;

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

  getRoomCode(): string | undefined {
    return this.roomCodeAccessor.get();
  }

  setRoomCode(code: string): void {
    this.roomCodeAccessor.set(code);
  }

  clearRoomCode(): void {
    this.roomCodeAccessor.clear();
  }

  getPlayerId(): string | undefined {
    return this.playerIdAccessor.get();
  }

  setPlayerId(playerId: string): void {
    this.playerIdAccessor.set(playerId);
  }

  clearPlayerId(): void {
    this.playerIdAccessor.clear();
  }

  reset(): void {
    this.clearRoomCode();
    this.clearPlayerId();
  }
}
