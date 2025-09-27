import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSocketConnection } from './useSocketConnection';

// Mock react-router hooks
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ roomCode: 'ABCD' }),
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
        handlers[e] = (handlers[e] || []).filter((h) => h !== cb);
      },
    },
    __emitServer: (e: string, ...a: unknown[]) =>
      (handlers[e] || []).forEach((h) => h(...a)),
  };
});
import * as socketModule from '../socket';

describe('useSocketConnection', () => {
  it('registers disconnect handler and does not navigate when already on /disconnected', () => {
    const nav = vi.fn();
    // override mocked navigate
    vi.doMock('react-router-dom', () => ({
      useNavigate: () => nav,
      useParams: () => ({ roomCode: '' }),
    }));
    Object.defineProperty(window, 'location', {
      value: { pathname: '/disconnected' },
      writable: true,
    });
    renderHook(() => useSocketConnection());
    (
      socketModule as unknown as {
        __emitServer: (e: string, ...a: unknown[]) => void;
      }
    ).__emitServer('disconnect', 'io server disconnect');
    expect(nav).not.toHaveBeenCalled();
  });
});
