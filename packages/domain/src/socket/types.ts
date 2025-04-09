export interface BasicResponse {
  success: boolean;
  error?: string;
}

export interface JoinRoomPayload {
  roomCode: string;
  playerId: string;
  name: string;
}

export interface LeaveRoomPayload {
  roomCode: string;
  playerId: string;
}

export interface SetPlayerSeatedPayload {
  roomCode: string;
  playerId: string;
  seated: boolean;
}

export interface SubmitWordPayload {
  roomCode: string;
  playerId: string;
  word: string;
}

export interface StartGamePayload {
  roomCode: string;
}

export interface PlayersUpdatedPayload {
  players: {
    id: string;
    name: string;
    isSeated: boolean;
  }[];
}

export interface PlayerUpdatedPayload {
  playerId: string;
  lives: number;
}

export interface GameStartedPayload {
  roomCode: string;
  fragment: string;
  bombDuration: number;
  currentPlayer: string | null;
  leaderId: string | null;
  players: {
    id: string;
    name: string;
    isEliminated: boolean;
    lives: number;
  }[];
}

export interface TurnStartedPayload {
  playerId: string | null;
  fragment: string;
  bombDuration: number;
  players: {
    id: string;
    name: string;
    isEliminated: boolean;
    lives: number;
  }[];
}

export interface GameEndedPayload {
  winnerId: string | null;
}

export interface WordAcceptedPayload {
  playerId: string;
  word: string;
}

export interface GameCountdownStartedPayload {
  deadline: number;
}
