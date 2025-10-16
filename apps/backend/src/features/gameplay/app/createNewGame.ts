import { Game } from '@game/domain/game/Game';
import { GameRoom } from '@game/domain/rooms/GameRoom';
import type { DictionaryPort } from '../../../platform/dictionary';
import { getLogger } from '../../../platform/logging/context';

/**
 * Instantiates a fresh {@link Game} for the provided room when enough players are seated.
 *
 * @param room - The room attempting to start a new match.
 * @param dictionary - Minimal dictionary port used to generate the opening fragment.
 * @returns A configured {@link Game} when the room is eligible, otherwise `null`.
 */
export function createNewGame(
  room: GameRoom,
  dictionary: Pick<DictionaryPort, 'getRandomFragment'>,
): Game | null {
  const seatedPlayers = room.getAllPlayers().filter((p) => p.isSeated);
  const log = getLogger();

  if (seatedPlayers.length < 2) {
    log.info(
      {
        event: 'game_start_not_enough_players',
        seatedCount: seatedPlayers.length,
        roomCode: room.code,
      },
      '[START GAME] Not enough seated players.',
    );
    return null;
  }
  log.info(
    {
      event: 'game_start_seated_players',
      roomCode: room.code,
      players: seatedPlayers.map((p) => p.name),
    },
    '[START GAME] Seated players registered',
  );

  seatedPlayers.forEach((p) => {
    p.resetForNextGame(
      room.rules.startingLives,
      room.rules.maxLives,
      room.rules.bonusTemplate,
    );
  });

  const fragment = dictionary.getRandomFragment(room.rules.minWordsPerPrompt);

  return new Game({
    roomCode: room.code,
    players: seatedPlayers,
    currentTurnIndex: 0,
    fragment,
    state: 'active',
    rules: room.rules,
  });
}
