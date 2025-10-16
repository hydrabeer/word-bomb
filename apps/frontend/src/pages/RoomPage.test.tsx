import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RoomPage from './RoomPage';
import type { PlayerStatsSnapshot } from '../hooks/usePlayerStats';
import type { RoomVisibility } from '../api/rooms';

// --- Mocks ---
vi.mock('../hooks/useGameRoom', () => ({ useGameRoom: () => undefined }));

let mockPlayers: {
  id: string;
  name: string;
  isSeated: boolean;
  isConnected?: boolean;
}[] = [];
let mockLeaderId: string | null = null;
let mockPlayerId = 'p1';
const mockMe = { id: 'p1', name: 'Alice', isSeated: false };
let mockRejected = false;
const setInputWordMock = vi.fn();
let mockPlayerStats: PlayerStatsSnapshot[] = [
  {
    playerId: 'p1',
    username: 'Alice',
    totalWords: 0,
    averageWpm: null,
    averageReactionSeconds: null,
    longWords: 0,
    accuracyStreak: 0,
    hyphenatedWords: 0,
  },
];
const toggleSeatedMock = vi.fn();
const startGameMock = vi.fn();
const registerRejectionMock = vi.fn();
let mockIsMobile = false;
let chatPropsLog: {
  headingId?: string;
  showStats?: boolean;
  stats?: unknown;
  autoFocus?: boolean;
}[] = [];

const renderWithRoute = (
  roomCode = 'ROOM',
  visibility: RoomVisibility = 'private',
) =>
  render(
    <MemoryRouter initialEntries={[`/${roomCode}`]}>
      <Routes>
        <Route
          path="/:roomCode"
          element={<RoomPage roomName="Test Room" visibility={visibility} />}
        />
      </Routes>
    </MemoryRouter>,
  );

vi.mock('../hooks/useIsMobile.ts', () => ({
  useIsMobile: () => mockIsMobile,
}));

vi.mock('../hooks/usePlayerManagement', () => ({
  usePlayerManagement: () => ({
    players: mockPlayers,
    leaderId: mockLeaderId,
    playerId: mockPlayerId,
    playerName: mockMe.name,
    me: mockMe,
    toggleSeated: toggleSeatedMock,
    startGame: startGameMock,
  }),
}));

vi.mock('../hooks/usePlayerStats', () => ({
  usePlayerStats: () => ({
    stats: mockPlayerStats,
    registerRejection: registerRejectionMock,
  }),
}));

vi.mock('../hooks/useWordSubmission', () => ({
  useWordSubmission: () => ({
    inputWord: '',
    setInputWord: setInputWordMock,
    rejected: mockRejected,
    handleSubmitWord: vi.fn(),
  }),
}));

vi.mock('../components/Chat', () => ({
  default: (props: {
    headingId?: string;
    showStats?: boolean;
    stats?: unknown;
    autoFocus?: boolean;
  }) => {
    chatPropsLog.push(props);
    return (
      <div
        data-testid="Chat"
        data-heading={props.headingId}
        aria-labelledby={props.headingId}
      >
        Chat
      </div>
    );
  },
}));
let lastGameBoardProps: {
  gameState?: { fragment?: string; players?: unknown[] } | null;
} | null = null;
vi.mock('../components/GameBoard', () => ({
  GameBoard: (props: {
    gameState?: { fragment?: string; players?: unknown[] } | null;
  }) => {
    lastGameBoardProps = props;
    return <div data-testid="GameBoard">{props.gameState?.fragment ?? ''}</div>;
  },
}));
vi.mock('react-icons/fa', () => ({
  FaChevronRight: () => null,
  FaChevronLeft: () => null,
  FaChevronUp: () => null,
  FaChevronDown: () => null,
  FaLink: () => null,
  FaHome: () => null,
  FaGlobe: () => null,
  FaLock: () => null,
}));

// useGameState mock (flip via shared var + rerender)
interface PlayerLite {
  id: string;
  name?: string;
  isEliminated?: boolean;
  lives?: number;
  isConnected?: boolean;
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
    mockRejected = false;
    mockPlayerStats = [
      {
        playerId: 'p1',
        username: 'Alice',
        totalWords: 0,
        averageWpm: null,
        averageReactionSeconds: null,
        longWords: 0,
        accuracyStreak: 0,
        hyphenatedWords: 0,
      },
    ];
    mockUseGameStateReturn = baseState;
    lastGameBoardProps = null;
    registerRejectionMock.mockReset();
    setInputWordMock.mockReset();
    mockIsMobile = false;
    chatPropsLog = [];
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  const element = (
    <MemoryRouter initialEntries={['/ROOM']}>
      <Routes>
        <Route
          path="/:roomCode"
          element={<RoomPage roomName="Test Room" visibility="private" />}
        />
      </Routes>
    </MemoryRouter>
  );

  it('navigates home when clicking the home button', () => {
    render(
      <MemoryRouter initialEntries={['/ROOM']}>
        <Routes>
          <Route path="/" element={<div>Home screen</div>} />
          <Route
            path="/:roomCode"
            element={<RoomPage roomName="Test Room" visibility="private" />}
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /home/i }));

    expect(screen.getByText('Home screen')).toBeInTheDocument();
  });

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

  it('syncs connection status from lobby players into game board state', () => {
    mockPlayers = [
      { id: 'p1', name: 'Alice', isSeated: true, isConnected: false },
    ];
    mockUseGameStateReturn = {
      ...baseState,
      gameState: {
        fragment: 'ab',
        bombDuration: 5,
        currentPlayerId: 'p1',
        players: [
          {
            id: 'p1',
            name: 'Alice',
            isEliminated: false,
            lives: 3,
            isConnected: true,
          },
        ],
      },
    };

    render(element);

    const syncedPlayers =
      (lastGameBoardProps?.gameState?.players as
        | { isConnected?: boolean }[]
        | undefined) ?? [];

    expect(syncedPlayers[0]?.isConnected).toBe(false);
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

  it('passes stats into the desktop chat with showStats enabled', () => {
    mockPlayerStats = [
      {
        playerId: 'p1',
        username: 'Alice',
        totalWords: 5,
        averageWpm: 120,
        averageReactionSeconds: 1,
        longWords: 2,
        accuracyStreak: 3,
        hyphenatedWords: 1,
      },
    ];

    renderWithRoute();

    const desktopProps = chatPropsLog.find(
      (entry) => entry.headingId === 'desktop-chat-heading',
    );

    expect(desktopProps?.showStats).toBe(true);
    expect(desktopProps?.stats).toBe(mockPlayerStats);
  });

  it('resets stats streak when submission rejected', () => {
    mockRejected = true;
    render(element);
    expect(registerRejectionMock).toHaveBeenCalledTimes(1);
  });

  it('does not pass stats to the mobile chat instance', () => {
    mockIsMobile = true;
    render(element);

    const mobileProps = chatPropsLog.find(
      (entry) => entry.headingId === 'mobile-chat-heading',
    );

    expect(mobileProps?.showStats).toBeUndefined();
    expect(mobileProps?.stats).toBeUndefined();
  });

  it('copies invite link and shows ephemeral feedback', () => {
    vi.useFakeTimers();
    const page = (
      <MemoryRouter initialEntries={['/ROOM42']}>
        <Routes>
          <Route
            path="/:roomCode"
            element={<RoomPage roomName="Test Room" visibility="public" />}
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

  it('annotates invite buttons with public visibility badge', () => {
    renderWithRoute('ROOM', 'public');
    const buttons = screen.getAllByLabelText(/Public room/i);
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button).toHaveTextContent(/Public/i);
    }
  });

  it('annotates invite buttons with private visibility badge', () => {
    renderWithRoute('ROOM', 'private');
    const buttons = screen.getAllByLabelText(/Private room/i);
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button).toHaveTextContent(/Private/i);
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
            element={<RoomPage roomName="Test Room" visibility="private" />}
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
