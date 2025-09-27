import { Game, GameRoom, Player } from '@game/domain';
import type {
  GameStartedPayload,
  TurnStartedPayload,
  PlayersUpdatedPayload,
  GamePlayerView,
} from '@word-bomb/types';

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
  const current = game.getCurrentPlayer();
  return {
    playerId: current.id,
    fragment: game.fragment,
    bombDuration: game.getBombDuration(),
    players: game.players.map((pl) => toGamePlayerView(pl, game.rules)),
  };
}

export function buildGameStartedPayload(
  room: GameRoom,
  game: Game,
): GameStartedPayload {
  const current = game.getCurrentPlayer();
  return {
    roomCode: game.roomCode,
    fragment: game.fragment,
    bombDuration: game.getBombDuration(),
    currentPlayer: current.id,
    leaderId: room.getLeaderId() ?? null,
    players: game.players.map((pl) => toGamePlayerView(pl, game.rules)),
  };
}
