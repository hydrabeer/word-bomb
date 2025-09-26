import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { act } from 'react';
import DisconnectedPage from './DisconnectedPage';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock navigate from react-router-dom but keep the rest
const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

// Mock socket with spies and helpers created inside the factory
vi.mock('../socket', () => {
  type OnceHandler = (payload?: unknown) => void;
  const onceHandlers: Record<string, OnceHandler[]> = {};
  let connected = false;
  const connectSpy = vi.fn(() => {
    // simulate starting a connection attempt; actual connection occurs on 'connect' event
  });
  const emitSpy = vi.fn(
    (
      _event: string,
      _payload?: unknown,
      ack?: (res?: unknown) => void,
    ) => {
      if (ack) ack({ success: true });
    },
  );
  function triggerOnce(event: string, payload?: unknown) {
    const list = onceHandlers[event] || [];
    onceHandlers[event] = [];
    // update connected flag based on event to mirror real socket behavior
    if (event === 'connect') connected = true;
    if (event === 'connect_error') connected = false;
    list.forEach((fn) => fn(payload));
  }
  function resetSocket() {
    connected = false;
    connectSpy.mockClear();
    emitSpy.mockClear();
    for (const k of Object.keys(onceHandlers)) delete onceHandlers[k];
  }
  return {
    socket: {
      get connected() {
        return connected;
      },
      connect: connectSpy,
      once: (event: string, cb: OnceHandler) => {
        (onceHandlers[event] ||= []).push(cb);
      },
      emit: emitSpy,
    },
    __triggerOnce: triggerOnce,
    __resetSocket: resetSocket,
    __connectSpy: connectSpy,
    __emitSpy: emitSpy,
  };
});

// Mock stable player profile
vi.mock('../utils/playerProfile', () => ({
  getOrCreatePlayerProfile: () => ({ id: 'me', name: 'Me' }),
}));

import * as socketModule from '../socket';
interface SocketTestHelpers {
  __triggerOnce: (event: string, payload?: unknown) => void;
  __resetSocket: () => void;
  __connectSpy: ReturnType<typeof vi.fn>;
  __emitSpy: ReturnType<typeof vi.fn>;
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/disconnected" element={<DisconnectedPage />} />
        <Route path="*" element={<div />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DisconnectedPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    navigateMock.mockClear();
    (socketModule as unknown as SocketTestHelpers).__resetSocket();
  });
  afterEach(() => {
    vi.clearAllTimers();
  });

  it('reconnects and rejoins room then navigates to the room', () => {
    renderAt('/disconnected?room=ROOMX&reason=boom');
    // Immediately attempts to reconnect on mount
    expect(
      screen.getByText(/Reconnecting \(attempt 1\/5\)\.\.\./i),
    ).toBeInTheDocument();

    // connect called on mount
    expect(
      (socketModule as unknown as SocketTestHelpers).__connectSpy,
    ).toHaveBeenCalledTimes(1);

    // trigger connect
    act(() => {
      (socketModule as unknown as SocketTestHelpers).__triggerOnce('connect');
    });

    // joinRoom emit with ack navigation
    expect(
      (socketModule as unknown as SocketTestHelpers).__emitSpy,
    ).toHaveBeenCalledWith(
      'joinRoom',
      expect.objectContaining({ roomCode: 'ROOMX', playerId: 'me', name: 'Me' }),
      expect.any(Function),
    );
    expect(
      screen.getByText('Reconnected! Redirecting...'),
    ).toBeInTheDocument();
    expect(navigateMock).toHaveBeenCalledWith('/ROOMX');
  });

  it('success without room navigates home after delay', () => {
    renderAt('/disconnected?reason=timeout');
    expect(
      (socketModule as unknown as SocketTestHelpers).__connectSpy,
    ).toHaveBeenCalledTimes(1);

    act(() => {
      (socketModule as unknown as SocketTestHelpers).__triggerOnce('connect');
    });
    expect(
      screen.getByText('Reconnected! Redirecting...'),
    ).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(navigateMock).toHaveBeenCalledWith('/');
  });

  it('retries after failure and then succeeds', () => {
    renderAt('/disconnected?room=R1');
    expect(
      (socketModule as unknown as SocketTestHelpers).__connectSpy,
    ).toHaveBeenCalledTimes(1);

    act(() => {
      (socketModule as unknown as SocketTestHelpers).__triggerOnce(
        'connect_error',
      );
    });
    expect(screen.getByText('Retry failed.')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(
      (socketModule as unknown as SocketTestHelpers).__connectSpy,
    ).toHaveBeenCalledTimes(2);

    act(() => {
      (socketModule as unknown as SocketTestHelpers).__triggerOnce('connect');
    });
    expect(navigateMock).toHaveBeenCalledWith('/R1');
  });

  it('max attempts disables Try Again and Home navigates', () => {
    renderAt('/disconnected?reason=x');
    const tryBtn = screen.getByRole('button', { name: /try again|reconnecting/i });
    const homeBtn = screen.getByRole('button', { name: /home/i });

    // clicking during reconnecting should not increase connects
    const initialCalls = (
      (socketModule as unknown as SocketTestHelpers).__connectSpy
    ).mock.calls.length;
    fireEvent.click(tryBtn);
    expect(
      (socketModule as unknown as SocketTestHelpers).__connectSpy,
    ).toHaveBeenCalledTimes(initialCalls);

    // fail via failsafe
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByText('Retry failed.')).toBeInTheDocument();

    // push attempts to max (total 5)
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByRole('button', { name: /try again/i }));
      act(() => {
        vi.advanceTimersByTime(4000);
      });
    }
    expect(screen.getByRole('button', { name: /try again/i })).toBeDisabled();
    expect(
      screen.getByText('Unable to reconnect automatically.'),
    ).toBeInTheDocument();

    fireEvent.click(homeBtn);
    expect(navigateMock).toHaveBeenCalledWith('/');
  });
});
