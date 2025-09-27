import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RoomPage from './RoomPage';

// Mock hooks used inside RoomPage
vi.mock('../hooks/useGameRoom', () => ({ useGameRoom: () => undefined }));
let mockPlayers: { id: string; name: string; isSeated: boolean }[] = [];
let mockLeaderId: string | null = null;
let mockPlayerId = 'p1';
const mockMe: { id: string; name: string; isSeated: boolean } = {
  id: 'p1',
  name: 'Alice',
  isSeated: false,
};
const toggleSeatedMock = vi.fn();
const startGameMock = vi.fn();
vi.mock('../hooks/usePlayerManagement', () => ({
  usePlayerManagement: () => ({
    players: mockPlayers,
    leaderId: mockLeaderId,
    playerId: mockPlayerId,
    me: mockMe,
    toggleSeated: toggleSeatedMock,
    startGame: startGameMock,
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

// Stub heavy UI modules to speed up rendering in this test file
vi.mock('../components/Chat', () => ({
  default: (props: { headingId?: string }) => (
    <div data-testid="Chat" aria-labelledby={props.headingId}>
      Chat
    </div>
  ),
}));
vi.mock('../components/GameBoard', () => ({
  GameBoard: (props: { gameState?: { fragment?: string } | null }) => (
    <div data-testid="GameBoard">{props.gameState?.fragment ?? ''}</div>
  ),
}));
vi.mock('react-icons/fa', () => ({
  FaChevronRight: () => null,
  FaChevronLeft: () => null,
  FaChevronUp: () => null,
  FaChevronDown: () => null,
  FaLink: () => null,
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

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

describe('RoomPage', () => {
  const renderWithRoute = (roomCode = 'ROOM') =>
    render(
      <MemoryRouter initialEntries={[`/${roomCode}`]}>
        <Routes>
          <Route
            path="/:roomCode"
            element={<RoomPage roomName="Test Room" />}
          />
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

  it('toggles chat via top-right button', () => {
    mockUseGameStateReturn = { ...baseState };
    renderWithRoute();
    const toggle = screen.getByTestId('chat-toggle-top');
    expect(toggle).toBeInTheDocument();
    fireEvent.click(toggle);
  });

  it('copies invite link on click and shows feedback', async () => {
    vi.useFakeTimers();
    mockUseGameStateReturn = { ...baseState };
    renderWithRoute('ROOM42');
    fireEvent.click(
      screen.getByRole('button', { name: /Copy room invite link/i }),
    );
    // The UI flips to "Copied!" after the clipboard promise resolves
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText(/copied!/i)).toBeInTheDocument();
    // And flips back after 2s; advance timers instead of waiting
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByText(/copied!/i)).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('renders players list with leader and seated markers', () => {
    mockPlayers = [
      { id: 'p1', name: 'Alice', isSeated: true },
      { id: 'p2', name: 'Bob', isSeated: false },
    ];
    mockLeaderId = 'p2';
    mockUseGameStateReturn = { ...baseState };
    renderWithRoute();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    // Check leader crown and seated check exist in DOM
    expect(
      screen.getAllByLabelText(/Game leader|Seated/).length,
    ).toBeGreaterThan(0);
  });

  it('shows Start now button only for leader and when countdown active', () => {
    mockPlayers = [{ id: 'p1', name: 'Alice', isSeated: true }];
    mockLeaderId = 'p1';
    mockPlayerId = 'p1';
    mockUseGameStateReturn = { ...baseState, timeLeftSec: 5 };
    const r1 = renderWithRoute();
    expect(
      screen.getByRole('button', { name: /Start game now/i }),
    ).toBeInTheDocument();
    r1.unmount();

    // Non-leader should not see button
    mockLeaderId = 'p2';
    mockUseGameStateReturn = { ...baseState, timeLeftSec: 5 };
    const r2 = renderWithRoute();
    expect(
      screen.queryByRole('button', { name: /Start game now/i }),
    ).not.toBeInTheDocument();
    r2.unmount();

    // No countdown
    mockLeaderId = 'p1';
    mockUseGameStateReturn = { ...baseState, timeLeftSec: 0 };
    renderWithRoute();
    expect(
      screen.queryByRole('button', { name: /Start game now/i }),
    ).not.toBeInTheDocument();
  });
});
