import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RoomPage from './RoomPage';

// Mock hooks used inside RoomPage
vi.mock('../hooks/useGameRoom', () => ({ useGameRoom: () => undefined }));
vi.mock('../hooks/usePlayerManagement', () => ({
  usePlayerManagement: () => ({
    players: [],
    leaderId: null,
    playerId: 'p1',
    me: { id: 'p1', name: 'Alice', isSeated: false },
    toggleSeated: vi.fn(),
    startGame: vi.fn(),
  }),
}));
vi.mock('../hooks/useWordSubmission', () => ({
  useWordSubmission: () => ({
    inputWord: '',
    setInputWord: vi.fn(),
    rejected: false,
    handleSubmitWord: vi.fn(),
  }),
}));

// We'll parametrize useGameState to simulate both lobby and playing modes
interface PlayerLite {
  id: string;
  name?: string;
}
interface GameStateHookReturn {
  gameState: {
    fragment: string;
    bombDuration: number;
    currentPlayerId: string;
    players: PlayerLite[];
  } | null;
  timeLeftSec: number;
  bombCountdown: number;
  elapsedGameTime: number;
  liveInputs: Record<string, string>;
  lastSubmittedWords: Record<string, string>;
  lastWordAcceptedBy: string | null;
  winnerId: string | null;
  updateLiveInput: (id: string, val: string) => void;
}
const baseState: GameStateHookReturn = {
  gameState: null,
  timeLeftSec: 0,
  bombCountdown: 0,
  elapsedGameTime: 0,
  liveInputs: {},
  lastSubmittedWords: {},
  lastWordAcceptedBy: null,
  winnerId: null,
  updateLiveInput: () => undefined,
};
let mockUseGameStateReturn: GameStateHookReturn = baseState;
vi.mock('../hooks/useGameState', () => ({
  useGameState: () => mockUseGameStateReturn,
}));

describe('RoomPage', () => {
  const renderWithRoute = (roomCode = 'ROOM') =>
    render(
      <MemoryRouter initialEntries={[`/${roomCode}`]}>
        <Routes>
          <Route path="/:roomCode" element={<RoomPage />} />
        </Routes>
      </MemoryRouter>,
    );

  it('renders lobby when not playing', () => {
    mockUseGameStateReturn = { ...baseState };
    renderWithRoute();
    expect(screen.getByText(/Waiting for players/i)).toBeTruthy();
  });

  it('renders GameBoard when playing', () => {
    mockUseGameStateReturn = {
      ...baseState,
      gameState: {
        fragment: 'ab',
        bombDuration: 5,
        currentPlayerId: 'p1',
        players: [],
      },
      bombCountdown: 3,
      elapsedGameTime: 10,
    };
    renderWithRoute();
    // Multiple spots show fragment; ensure at least one instance present
    expect(screen.getAllByText('ab').length).toBeGreaterThan(0);
  });
});
