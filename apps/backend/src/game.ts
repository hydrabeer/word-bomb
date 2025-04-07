type Player = {
  id: string;
  name: string;
  userToken: string;
  isAlive: boolean;
};

type Room = {
  code: string;
  roomName?: string;
  players: Player[];
  currentTurnIndex: number;
  usedWords: Set<string>;
  fragment: string;
  isPlaying: boolean;
};

const rooms = new Map<string, Room>();

export { Player, Room, rooms };
