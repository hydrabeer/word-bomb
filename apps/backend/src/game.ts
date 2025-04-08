interface Player {
  id: string;
  name: string;
  userToken: string;
  isAlive: boolean;
}

interface Game {
  code: string;
  roomName?: string;
  players: Player[];
  playersById: Map<string, Player>;
  currentTurnIndex: number;
  usedWords: Set<string>;
  fragment: string;
  isPlaying: boolean;
}

const rooms = new Map<string, Game>();

export { Player, Game, rooms };
