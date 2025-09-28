import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import NotFoundPage from './NotFoundPage';
import RoomRoute from './RoomRoute';
import * as DocumentTitleHook from '../hooks/useDocumentTitle';

// Mock heavy hooks inside RoomPage to keep tests light
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
vi.mock('../hooks/useGameState', () => ({
  useGameState: () => ({
    gameState: null,
    timeLeftSec: 0,
    bombCountdown: 0,
    elapsedGameTime: 0,
    liveInputs: {},
    lastSubmittedWords: {},
    lastWordAcceptedBy: null,
    winnerId: null,
    updateLiveInput: () => undefined,
  }),
}));

// Utility to render only routing layer similar to main.tsx (subset)
function renderRoute(initial: string) {
  render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        {/* Attempt to interpret any first-level segment as a room; component decides validity */}
        <Route path=":roomCode" element={<RoomRoute />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Routing / room code handling', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
    document.title = 'Initial Title';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('shows 404 page for invalid room code format', () => {
    renderRoute('/foobar'); // not 4 uppercase letters
    expect(screen.getByText(/404/i)).toBeTruthy();
  });

  it('sets title while loading and updates when room resolves', async () => {
    const deferred: {
      promise: Promise<{
        ok: boolean;
        json: () => Promise<{ exists: boolean; name?: string }>;
      }>;
      resolve: (value: {
        ok: boolean;
        json: () => Promise<{ exists: boolean; name?: string }>;
      }) => void;
    } = (() => {
      let resolve!: (value: {
        ok: boolean;
        json: () => Promise<{ exists: boolean; name?: string }>;
      }) => void;
      const promise = new Promise<{
        ok: boolean;
        json: () => Promise<{ exists: boolean; name?: string }>;
      }>((res) => {
        resolve = res;
      });
      return { promise, resolve };
    })();

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      deferred.promise,
    );

    renderRoute('/ABCD');

    await waitFor(() =>
      expect(document.title).toBe('Loading Room ABCD — Word Bomb'),
    );

    deferred.resolve({
      ok: true,
      json: () =>
        Promise.resolve({ exists: true, name: '  Champions Lounge  ' }),
    });

    await waitFor(() => expect(document.title).toBe('[ABCD] Champions Lounge'));
  });

  it('shows room missing page for valid-looking but nonexistent room', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
    });
    renderRoute('/ABCD');
    await waitFor(() => screen.getByText(/Room Not Found/i));
    expect(screen.getByText(/Room Not Found/i)).toBeTruthy();
  });

  it('renders RoomPage when room exists', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ exists: true }),
    });
    renderRoute('/WXYZ');
    await waitFor(() => screen.getByText(/Waiting for players/i));
    // Multiple UI elements include the room label; ensure at least one matches
    expect(screen.getAllByText(/Room WXYZ/i).length).toBeGreaterThan(0);
  });

  it('uses generic loading title when room code missing', () => {
    const spy = vi.spyOn(DocumentTitleHook, 'useDocumentTitle');

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<RoomRoute />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(spy).toHaveBeenCalledWith('Loading Room — Word Bomb');
    spy.mockRestore();
  });
});
