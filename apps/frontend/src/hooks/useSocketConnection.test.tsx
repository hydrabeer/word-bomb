import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSocketConnection } from './useSocketConnection';

// Stable mocks for react-router hooks
const navMock = vi.fn();
const paramsRef: { roomCode?: string } = { roomCode: 'ABCD' };
vi.mock('react-router-dom', () => ({
  useNavigate: () => navMock,
  useParams: () => paramsRef,
}));

// Mock socket with on/off and a way to trigger disconnect
vi.mock('../socket', () => {
  const handlers: Record<string, ((...a: unknown[]) => void)[]> = {};
  return {
    socket: {
      on: (e: string, cb: (...a: unknown[]) => void) => {
        (handlers[e] ||= []).push(cb);
      },
      off: (e: string, cb: (...a: unknown[]) => void) => {
        handlers[e] = handlers[e].filter((h) => h !== cb);
      },
    },
    __emitServer: (e: string, ...a: unknown[]) => {
      handlers[e].forEach((h) => {
        h(...a);
      });
    },
  };
});
import * as socketModule from '../socket';

beforeEach(() => {
  navMock.mockReset();
  paramsRef.roomCode = 'ABCD';
});

describe('useSocketConnection', () => {
  it('registers disconnect handler and does not navigate when already on /disconnected', () => {
    paramsRef.roomCode = undefined;
    Object.defineProperty(window, 'location', {
      value: { pathname: '/disconnected' },
      writable: true,
    });
    renderHook(() => {
      useSocketConnection();
    });
    (
      socketModule as unknown as {
        __emitServer: (e: string, ...a: unknown[]) => void;
      }
    ).__emitServer('disconnect', 'io server disconnect');
    expect(navMock).not.toHaveBeenCalled();
  });

  it('navigates to /disconnected with params on disconnect', () => {
    paramsRef.roomCode = 'ROOM';
    Object.defineProperty(window, 'location', {
      value: { pathname: '/room/ROOM' },
      writable: true,
    });
    renderHook(() => {
      useSocketConnection();
    });
    (
      socketModule as unknown as {
        __emitServer: (e: string, ...a: unknown[]) => void;
      }
    ).__emitServer('disconnect', 'io server disconnect');
    expect(navMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /\/disconnected\?room=ROOM&reason=io\+server\+disconnect/,
      ),
    );
  });
});
