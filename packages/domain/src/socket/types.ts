// packages/domain/src/socket/types.ts

// Generic response used in all callback-based events
export interface BasicResponse {
  success: boolean;
  error?: string;
}

// --- Payloads from client to server ---

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
  clientActionId?: string; // for optimistic UI correlation
}

export interface StartGamePayload {
  roomCode: string;
}

export interface ChatMessagePayload {
  roomCode: string;
  sender: string;
  message: string;
  timestamp: number;
  type?: 'user' | 'system' | undefined;
}

// --- Payloads from server to client ---

export interface PlayersUpdatedPayload {
  players: {
    id: string;
    name: string;
    isSeated: boolean;
    isConnected?: boolean; // optional for reconnection awareness
  }[];
  leaderId?: string;
}

// More compact diff update to reduce bandwidth for frequent player state changes
export interface PlayersDiffPayload {
  added: {
    id: string;
    name: string;
    isSeated: boolean;
    isConnected?: boolean;
  }[];
  updated: {
    id: string;
    changes: Partial<{
      name: string;
      isSeated: boolean;
      isConnected: boolean;
    }>;
  }[];
  removed: string[];
  leaderIdChanged?: string; // new leader id (or empty string if none)
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

export interface PlayerTypingPayload {
  roomCode: string;
  playerId: string;
  input: string;
}

export interface PlayerTypingUpdatePayload {
  playerId: string;
  input: string;
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

export interface ActionAckPayload {
  clientActionId: string;
  success: boolean;
  error?: string;
}

// --- Event Maps ---

export interface ClientToServerEvents {
  joinRoom: (data: JoinRoomPayload, cb?: (res: BasicResponse) => void) => void;
  leaveRoom: (data: LeaveRoomPayload) => void;
  chatMessage: (data: ChatMessagePayload) => void;
  setPlayerSeated: (
    data: SetPlayerSeatedPayload,
    cb?: (res: BasicResponse) => void,
  ) => void;
  startGame: (
    data: StartGamePayload,
    cb?: (res: BasicResponse) => void,
  ) => void;
  playerTyping: (data: PlayerTypingPayload) => void;
  submitWord: (
    data: SubmitWordPayload,
    cb?: (res: BasicResponse) => void,
  ) => void;
}

export interface ServerToClientEvents {
  playersUpdated: (data: PlayersUpdatedPayload) => void;
  playersDiff: (data: PlayersDiffPayload) => void;
  playerUpdated: (data: PlayerUpdatedPayload) => void;
  chatMessage: (data: ChatMessagePayload) => void;
  gameStarted: (data: GameStartedPayload) => void;
  turnStarted: (data: TurnStartedPayload) => void;
  gameEnded: (data: GameEndedPayload) => void;
  playerTypingUpdate: (data: PlayerTypingUpdatePayload) => void;
  wordAccepted: (data: WordAcceptedPayload) => void;
  gameCountdownStarted: (data: GameCountdownStartedPayload) => void;
  gameCountdownStopped: () => void;
  actionAck: (data: ActionAckPayload) => void;
}

export interface SocketData {
  currentRoomCode?: string;
}
