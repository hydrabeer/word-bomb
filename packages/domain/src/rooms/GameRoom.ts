import { z } from 'zod';
import { Player } from '../players/Player';
import { createPlayer } from '../players/createPlayer';
import { GameRoomRules } from './GameRoomRules';
import { Game } from '../game/Game';

export const GameRoomSchema = z.object({
  code: z.string().regex(/[A-Z]{4}/),
});

export type GameRoomProps = z.infer<typeof GameRoomSchema>;

/**
 * Represents a game room where players can gather, configure rules,
 * and play a game of Word Bomb. Manages player state, seating, leadership,
 * game lifecycle, and game start timers.
 */
export class GameRoom {
  /** 4-letter uppercase room code */
  public readonly code: string;

  /** Human-friendly room title shown in UI */
  public name = '';

  /** Custom rules for this room */
  public rules: GameRoomRules;

  /** Active game instance if a game is in progress */
  public game?: Game;

  private players = new Map<string, Player>();
  private state: 'seating' | 'playing' = 'seating';
  private leaderId: string | null = null;
  private startGameTimerHandle?: ReturnType<typeof setTimeout>;

  /**
   * Creates a new game room with a specific room code and rules.
   * @param props The room's identifying code
   * @param rules The rules that apply to this room
   */
  constructor(props: GameRoomProps, rules: GameRoomRules) {
    const parsed = GameRoomSchema.parse(props);
    this.code = parsed.code;
    this.rules = rules;
  }

  /**
   * Adds a player to the room and designates them as leader if they are first.
   * @param props The player's initial properties
   * @throws If a player with the same ID already exists
   */
  addPlayer({ id, name }: { id: string; name: string }): void {
    if (this.players.has(id)) throw new Error('Player already in room.');

    const isLeader = this.players.size === 0;

    const player = createPlayer({
      id,
      name,
      isLeader,
      lives: this.rules.maxLives,
      bonusTemplate: this.rules.bonusTemplate,
    });

    this.players.set(id, player);

    if (isLeader) {
      this.leaderId = id;
    }
  }

  /**
   * Removes a player from the room. If they were the leader, assigns a new one.
   * @param playerId The ID of the player to remove
   */
  removePlayer(playerId: string): void {
    this.players.delete(playerId);
    if (playerId === this.leaderId) {
      this.assignNewLeader();
    }
  }

  /**
   * Checks whether a player is in the room.
   * @param playerId The ID to check for
   * @returns True if the player exists in the room
   */
  hasPlayer(playerId: string): boolean {
    return this.players.has(playerId);
  }

  /**
   * Retrieves a player object by ID, if they exist.
   * @param playerId The ID of the player to retrieve
   * @returns The player, or undefined if not found
   */
  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  /**
   * Assigns leadership to the first remaining player in the room, if any.
   */
  assignNewLeader(): void {
    const remaining = Array.from(this.players.values());
    if (remaining.length === 0) {
      this.leaderId = null;
    } else {
      remaining[0].isLeader = true;
      this.leaderId = remaining[0].id;
    }
  }

  /**
   * Gets the current leader's player ID, or null if there is no leader.
   */
  public getLeaderId(): string | null {
    return this.leaderId;
  }

  /**
   * Returns an array of all players currently in the room.
   */
  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  /**
   * Marks a player's connectivity state without removing them from the room.
   * Used to support reconnection after transient network issues.
   */
  setPlayerConnected(playerId: string, isConnected: boolean): void {
    const player = this.players.get(playerId);
    if (player) {
      player.isConnected = isConnected;
    }
  }

  /**
   * Sets a player’s intent to join the next game.
   * @param playerId The ID of the player
   * @param seated Whether they are joining (true) or spectating (false)
   */
  setPlayerSeated(playerId: string, seated: boolean): void {
    const player = this.players.get(playerId);
    if (player) {
      player.isSeated = seated;
    }
  }

  /**
   * Starts a new game with all seated players.
   * @throws If fewer than 2 players are seated
   */
  startGame(): void {
    const playersInGame = this.getAllPlayers().filter((p) => p.isSeated);
    if (playersInGame.length < 2)
      throw new Error('Need at least 2 players seated to start the game.');
    this.state = 'playing';

    // Reset all players for the new game.
    playersInGame.forEach((p) => {
      p.resetForNextGame(this.rules.maxLives, this.rules.bonusTemplate);
    });

    this.cancelGameStartTimer();
  }

  /**
   * Ends the current game and returns the room to the seating phase.
   * Also clears seated state for all players.
   */
  endGame(): void {
    this.state = 'seating';
    this.game = undefined;
    this.getAllPlayers().forEach((p) => {
      p.isSeated = false;
    });
  }

  /**
   * Begins a countdown to automatically start the game after a given duration.
   * If already running, this has no effect.
   * @param callback Function to call when the timer elapses
   * @param duration Time in milliseconds before starting the game
   */
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

  /**
   * Cancels the pending game start timer, if active.
   */
  cancelGameStartTimer(): void {
    if (this.startGameTimerHandle) {
      clearTimeout(this.startGameTimerHandle);
      this.startGameTimerHandle = undefined;
      console.log(`[CANCEL GAME TIMER] Timer canceled for room ${this.code}`);
    }
  }

  /**
   * Indicates whether the room's game-start timer is currently active.
   * @returns True if the timer is running
   */
  public isGameTimerRunning(): boolean {
    return !!this.startGameTimerHandle;
  }
}
