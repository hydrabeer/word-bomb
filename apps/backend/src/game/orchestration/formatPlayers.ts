// A helper to format players for broadcast.
import { Game } from '@game/domain/game/Game';
import { Player } from '@game/domain/players/Player';

export function formatPlayers(game: Game) {
  return game.players.map((p: Player) => ({
    id: p.id,
    name: p.name,
    isEliminated: p.isEliminated,
    lives: p.lives,
  }));
}
