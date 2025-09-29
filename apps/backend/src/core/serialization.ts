import type { Game } from '@game/domain/game/Game';
import type { GameRoom } from '@game/domain/rooms/GameRoom';
import type { Player } from '@game/domain/players/Player';
import type {
  GameStartedPayload,
  TurnStartedPayload,
  PlayersUpdatedPayload,
  GamePlayerView,
} from '@word-bomb/types/socket';

// Player view helpers (room vs in-game)
export function toRoomPlayerView(p: Player) {
  return {
    id: p.id,
    name: p.name,
    isSeated: p.isSeated,
    isConnected: p.isConnected,
  };
}

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

export function buildPlayersUpdatedPayload(
  room: GameRoom,
): PlayersUpdatedPayload {
  return {
    players: room.getAllPlayers().map(toRoomPlayerView),
    leaderId: room.getLeaderId() ?? undefined,
  };
}

export function buildTurnStartedPayload(game: Game): TurnStartedPayload {
  return {
    playerId: getCurrentPlayerId(game),
    ...buildBaseGamePayload(game),
  };
}

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

function buildBaseGamePayload(game: Game) {
  return {
    fragment: game.fragment,
    bombDuration: game.getBombDuration(),
    players: game.players.map((pl) => toGamePlayerView(pl, game.rules)),
  } satisfies Pick<GameStartedPayload, 'fragment' | 'bombDuration' | 'players'>;
}

function getCurrentPlayerId(game: Game): string {
  return game.getCurrentPlayer().id;
}
