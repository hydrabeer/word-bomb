import { Game } from '@game/domain/game/Game';
import { Player } from '@game/domain/players/Player';
import { GameRoom } from '@game/domain/rooms/GameRoom';
import type {
  GameStartedPayload,
  TurnStartedPayload,
  PlayersUpdatedPayload,
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

export function toGamePlayerView(p: Player) {
  return {
    id: p.id,
    name: p.name,
    isEliminated: p.isEliminated,
    lives: p.lives,
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
    players: game.players.map(toGamePlayerView),
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
    players: game.players.map(toGamePlayerView),
  };
}
