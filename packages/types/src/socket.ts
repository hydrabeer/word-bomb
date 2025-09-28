// Socket and shared DTO types extracted from domain package
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
  clientActionId?: string;
}
export interface StartGamePayload {
  roomCode: string;
}
export interface ChatMessagePayload {
  roomCode: string;
  sender: string;
  message: string;
  timestamp: number;
  type?: 'user' | 'system';
}

export interface PlayersUpdatedPayload {
  players: {
    id: string;
    name: string;
    isSeated: boolean;
    isConnected?: boolean;
  }[];
  leaderId?: string;
}
export interface PlayersDiffPayload {
  added: {
    id: string;
    name: string;
    isSeated: boolean;
    isConnected?: boolean;
  }[];
  updated: {
    id: string;
    changes: Partial<{ name: string; isSeated: boolean; isConnected: boolean }>;
  }[];
  removed: string[];
  /**
   * When present, indicates that the room leader changed. `null` signals that
   * the room no longer has a leader.
   */
  leaderIdChanged?: string | null;
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
  players: GamePlayerView[];
}
export interface TurnStartedPayload {
  playerId: string | null;
  fragment: string;
  bombDuration: number;
  players: GamePlayerView[];
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

export interface RoomRulesPayload {
  roomCode: string;
  rules: {
    maxLives: number;
    startingLives: number;
    bonusTemplate: number[];
    minTurnDuration: number;
    minWordsPerPrompt: number;
  };
}

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
  updateRoomRules: (
    data: RoomRulesPayload,
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
  roomRulesUpdated: (data: RoomRulesPayload) => void;
}
export interface SocketData {
  currentRoomCode?: string;
}

// --- Bonus Alphabet in-game player view extensions ---
export interface BonusProgressView {
  // Remaining counts per letter (length 26), 0 means fulfilled for that letter
  remaining: number[];
  // Total required per letter (length 26); may be 0 for letters not in subset
  total: number[];
}

export interface GamePlayerView {
  id: string;
  name: string;
  isEliminated: boolean;
  lives: number;
  // Optional to allow older servers/clients; present during active game payloads
  bonusProgress?: BonusProgressView;
}
