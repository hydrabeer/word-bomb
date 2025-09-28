import { Game, GameRoom } from '@game/domain';
import type { DictionaryPort } from '../../dictionary';

export function createNewGame(
  room: GameRoom,
  dictionary: Pick<DictionaryPort, 'getRandomFragment'>,
): Game | null {
  const seatedPlayers = room.getAllPlayers().filter((p) => p.isSeated);

  if (seatedPlayers.length < 2) {
    console.log('[START GAME] Not enough seated players.');
    return null;
  }
  console.log(
    '[START GAME] Seated players:',
    seatedPlayers.map((p) => p.name),
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
