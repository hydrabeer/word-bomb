import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RoomPage from './RoomPage';

// --- Mocks ---
vi.mock('../hooks/useGameRoom', () => ({ useGameRoom: () => undefined }));

let mockPlayers: { id: string; name: string; isSeated: boolean }[] = [];
let mockLeaderId: string | null = null;
let mockPlayerId = 'p1';
const mockMe = { id: 'p1', name: 'Alice', isSeated: false };
const toggleSeatedMock = vi.fn();
const startGameMock = vi.fn();

const renderWithRoute = (roomCode = 'ROOM') =>
  render(
    <MemoryRouter initialEntries={[`/${roomCode}`]}>
      <Routes>
        <Route path="/:roomCode" element={<RoomPage roomName="Test Room" />} />
      </Routes>
    </MemoryRouter>,
  );

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

// useGameState mock (flip via shared var + rerender)
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

// Clipboard
Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

describe('RoomPage (fast)', () => {
  beforeEach(() => {
    // default state before each to keep tests isolated
    mockPlayers = [];
    mockLeaderId = null;
    mockPlayerId = 'p1';
    mockUseGameStateReturn = baseState;
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  const element = (
    <MemoryRouter initialEntries={['/ROOM']}>
      <Routes>
        <Route path="/:roomCode" element={<RoomPage roomName="Test Room" />} />
      </Routes>
    </MemoryRouter>
  );

  it('renders lobby when not playing', () => {
    render(element);
    expect(screen.getByText(/Waiting for players/i)).toBeInTheDocument();
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
    const { rerender } = render(element);
    rerender(element);
    // Fragment shows at least once
    expect(screen.getByTestId('GameBoard')).toHaveTextContent('ab');
  });

  it('toggles chat via top-right button', () => {
    renderWithRoute();
    const toggle = screen.getByTestId('chat-toggle-top');

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('copies invite link and shows ephemeral feedback', async () => {
    vi.useFakeTimers();
    const page = (
      <MemoryRouter initialEntries={['/ROOM42']}>
        <Routes>
          <Route
            path="/:roomCode"
            element={<RoomPage roomName="Test Room" />}
          />
        </Routes>
      </MemoryRouter>
    );
    try {
      render(page);

      const copyButton = screen.getAllByRole('button', {
        name: /Copy room invite link/i,
      })[0];

      act(() => {
        fireEvent.click(copyButton);
      });
      expect(copyButton).toHaveTextContent(/copied/i);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(copyButton).not.toHaveTextContent(/copied/i);
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders players list with leader + seated markers', () => {
    mockPlayers = [
      { id: 'p1', name: 'Alice', isSeated: true },
      { id: 'p2', name: 'Bob', isSeated: false },
    ];
    mockLeaderId = 'p2';
    const { rerender } = render(element);
    rerender(element);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    // one or more markers exist
    expect(
      screen.getAllByLabelText(/Game leader|Seated/).length,
    ).toBeGreaterThan(0);
  });

  it('shows Start now only for leader and when countdown active', () => {
    const element = (
      <MemoryRouter initialEntries={['/ROOM']}>
        <Routes>
          <Route
            path="/:roomCode"
            element={<RoomPage roomName="Test Room" />}
          />
        </Routes>
      </MemoryRouter>
    );

    // Leader + countdown → visible
    mockPlayers = [{ id: 'p1', name: 'Alice', isSeated: true }];
    mockLeaderId = 'p1';
    mockPlayerId = 'p1';
    mockUseGameStateReturn = { ...baseState, timeLeftSec: 5 };
    const r1 = render(element);
    expect(screen.getByTestId('start-now-btn')).toBeInTheDocument();
    r1.unmount();

    // Non-leader + countdown → hidden
    mockLeaderId = 'p2';
    mockUseGameStateReturn = { ...baseState, timeLeftSec: 5 };
    const r2 = render(element);
    expect(screen.queryByTestId('start-now-btn')).not.toBeInTheDocument();
    r2.unmount();

    // Leader, no countdown → hidden
    mockLeaderId = 'p1';
    mockUseGameStateReturn = { ...baseState, timeLeftSec: 0 };
    const r3 = render(element);
    expect(screen.queryByTestId('start-now-btn')).not.toBeInTheDocument();
    r3.unmount();
  });
});
