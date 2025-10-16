import type { Game } from '@game/domain/game/Game';
import type { GameRoom } from '@game/domain/rooms/GameRoom';
import type { Player } from '@game/domain/players/Player';
import type {
  GameStartedPayload,
  TurnStartedPayload,
  PlayersUpdatedPayload,
  GamePlayerView,
} from '@word-bomb/types/socket';

/**
 * Produces a lobby-safe projection of a player's state for room views.
 *
 * @param p - Player being transformed into a room representation.
 * @returns Minimal view required for lobby hydration.
 */
export function toRoomPlayerView(p: Player) {
  return {
    id: p.id,
    name: p.name,
    isSeated: p.isSeated,
    isConnected: p.isConnected,
  };
}

/**
 * Derives a game-time projection of a player's state including bonus progress.
 *
 * @param p - Player being transformed into an in-game representation.
 * @param rules - Active rule configuration to derive bonus progress.
 * @returns Player view required for the running game state.
 */
export function toGamePlayerView(
  p: Player,
  rules: Game['rules'],
): GamePlayerView {
  return {
    id: p.id,
    name: p.name,
    isEliminated: p.isEliminated,
    lives: p.lives,
    isConnected: p.isConnected,
    bonusProgress: p.getBonusProgressSnapshot(rules.bonusTemplate),
  };
}

/**
 * Builds the canonical payload emitted when the room roster changes.
 *
 * @param room - Room instance providing player and leader state.
 * @returns Payload fed into the `playersUpdated` socket event.
 */
export function buildPlayersUpdatedPayload(
  room: GameRoom,
): PlayersUpdatedPayload {
  return {
    players: room.getAllPlayers().map(toRoomPlayerView),
    leaderId: room.getLeaderId() ?? undefined,
  };
}

/**
 * Constructs the payload shared when a new turn begins in an active game.
 *
 * @param game - Game providing the current fragment, duration, and turn owner.
 * @returns Payload for the `turnStarted` socket event.
 */
export function buildTurnStartedPayload(game: Game): TurnStartedPayload {
  return {
    playerId: getCurrentPlayerId(game),
    ...buildBaseGamePayload(game),
  };
}

/**
 * Creates the comprehensive payload emitted when a game transitions out of lobby.
 *
 * @param room - Room source of leader metadata for the payload.
 * @param game - Game providing active state for the start snapshot.
 * @returns Payload for the `gameStarted` socket event.
 */
export function buildGameStartedPayload(
  room: GameRoom,
  game: Game,
): GameStartedPayload {
  return {
    roomCode: game.roomCode,
    currentPlayer: getCurrentPlayerId(game),
    leaderId: room.getLeaderId() ?? null,
    ...buildBaseGamePayload(game),
  };
}

/**
 * Generates the shared portion of game payloads, centralizing serialization logic.
 *
 * @param game - Game instance used to compute the shared fields.
 * @returns Common game payload fragment reused by multiple socket events.
 */
function buildBaseGamePayload(game: Game) {
  return {
    fragment: game.fragment,
    bombDuration: game.getBombDuration(),
    players: game.players.map((pl) => toGamePlayerView(pl, game.rules)),
  } satisfies Pick<GameStartedPayload, 'fragment' | 'bombDuration' | 'players'>;
}

/**
 * Safely retrieves the identifier of the player whose turn is currently active.
 *
 * @param game - Game whose active player should be resolved.
 * @returns Identifier for the current player.
 */
function getCurrentPlayerId(game: Game): string {
  return game.getCurrentPlayer().id;
}
