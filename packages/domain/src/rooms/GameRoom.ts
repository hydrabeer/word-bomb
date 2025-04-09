import { z } from 'zod';
import { Player, PlayerProps } from '../players/Player';
import { createPlayer } from '../players/createPlayer';
import { GameRoomRules } from './GameRoomRules';
import { Game } from '../game/Game';

export const GameRoomSchema = z.object({
  code: z.string().regex(/[A-Z]{4}/),
});

export type GameRoomProps = z.infer<typeof GameRoomSchema>;

export class GameRoom {
  public readonly code: string;
  public rules: GameRoomRules;
  private players = new Map<string, Player>();
  private state: 'seating' | 'playing' = 'seating';
  private leaderId: string | null = null;
  public game?: Game; // Active game instance, if any.
  private startGameTimerHandle?: ReturnType<typeof setTimeout>;

  constructor(props: GameRoomProps, rules: GameRoomRules) {
    const parsed = GameRoomSchema.parse(props);
    this.code = parsed.code;
    this.rules = rules;
  }

  addPlayer(props: PlayerProps): void {
    if (this.players.has(props.id)) throw new Error('Player already in room.');

    const player = createPlayer({
      props: {
        ...props,
        lives: this.rules.maxLives,
        isLeader: this.players.size === 0, // first player is leader
      },
      bonusTemplate: this.rules.bonusTemplate,
    });

    this.players.set(player.id, player);

    if (player.isLeader) {
      this.leaderId = player.id;
    }
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
    if (playerId === this.leaderId) {
      this.assignNewLeader();
    }
  }

  hasPlayer(playerId: string): boolean {
    return this.players.has(playerId);
  }

  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  assignNewLeader(): void {
    const remaining = Array.from(this.players.values());
    if (remaining.length === 0) {
      this.leaderId = null;
    } else {
      remaining[0].isLeader = true;
      this.leaderId = remaining[0].id;
    }
  }

  public getLeaderId(): string | null {
    return this.leaderId;
  }

  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  // Set a player's seating state (true = joins game, false = spectator)
  setPlayerSeated(playerId: string, seated: boolean): void {
    const player = this.players.get(playerId);
    if (player) {
      player.isSeated = seated;
    }
  }

  // Starts the game once enough players are seated.
  startGame(): void {
    const playersInGame = this.getAllPlayers().filter((p) => p.isSeated);
    if (playersInGame.length < 2)
      throw new Error('Need at least 2 players seated to start the game.');
    this.state = 'playing';

    // Reset all players for the new game.
    playersInGame.forEach((p) => {
      p.resetForNextGame(this.rules.maxLives, this.rules.bonusTemplate);
    });

    // Optionally, cancel any pending start timer.
    this.cancelGameStartTimer();
  }

  // Ends the game and reverts the room to seating.
  endGame(): void {
    this.state = 'seating';
    this.game = undefined;
    this.getAllPlayers().forEach((p) => {
      p.isSeated = false;
    });
  }

  // Starts a 15-second timer that, when elapsed, will trigger the game start.
  // The callback should start the game.
  startGameStartTimer(callback: () => void, duration: number): void {
    if (!this.startGameTimerHandle) {
      this.startGameTimerHandle = setTimeout(() => {
        this.startGameTimerHandle = undefined;
        callback();
      }, duration);
      console.log(
        `[START GAME TIMER] Timer started for room ${this.code} for ${duration.toString()} ms`,
      );
    }
  }

  // Cancels the start game timer if it's running.
  cancelGameStartTimer(): void {
    if (this.startGameTimerHandle) {
      clearTimeout(this.startGameTimerHandle);
      this.startGameTimerHandle = undefined;
      console.log(`[CANCEL GAME TIMER] Timer canceled for room ${this.code}`);
    }
  }

  public isGameTimerRunning(): boolean {
    return !!this.startGameTimerHandle;
  }
}
