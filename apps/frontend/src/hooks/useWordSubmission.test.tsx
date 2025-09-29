import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWordSubmission } from './useWordSubmission';

// Strongly typed mock socket for this test
interface SubmitPayload {
  word: string;
  playerId: string;
  clientActionId: string;
}
interface MockSocket {
  on: (e: string, cb: (p?: unknown) => void) => void;
  off: (e: string, cb: (p?: unknown) => void) => void;
  emit: (e: 'submitWord', payload: SubmitPayload) => void;
}

vi.mock('../socket', () => {
  const handlers: Record<string, ((p?: unknown) => void)[]> = {};
  const emitMock = vi.fn<(e: 'submitWord', payload: SubmitPayload) => void>();
  const on: MockSocket['on'] = (e, cb) => {
    (handlers[e] ||= []).push(cb);
  };
  const off: MockSocket['off'] = (e, cb) => {
    handlers[e] = handlers[e].filter((h) => h !== cb);
  };
  const emit: MockSocket['emit'] = (e, p) => { emitMock(e, p); };
  const __emitServer = (e: string, p?: unknown) => {
    handlers[e].forEach((h) => { h(p); });
  };
  const __getEmitted = () => emitMock.mock.calls as [string, SubmitPayload][];
  const socket: MockSocket = { on, off, emit };
  return { socket, __emitServer, __getEmitted };
});
import * as socketModule from '../socket';

interface TestHelpers {
  __emitServer: (e: string, p?: unknown) => void;
  __getEmitted: () => [string, SubmitPayload][];
}
const { __emitServer, __getEmitted } = socketModule as unknown as TestHelpers;

describe('useWordSubmission', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('emits submitWord with optimistic clear and handles rejection ack', () => {
    const { result } = renderHook(() => useWordSubmission('ROOM', 'p1'));

    act(() => {
      result.current.setInputWord('apple');
    });
    act(() => {
      result.current.handleSubmitWord();
    });

    expect(result.current.inputWord).toBe('');
    const emitted = __getEmitted();
    expect(emitted.length).toBeGreaterThan(0);
    const last = emitted[emitted.length - 1];
    const payload = last[1];

    act(() => {
      __emitServer('actionAck', {
        clientActionId: payload.clientActionId,
        success: false,
      });
      vi.advanceTimersByTime(10);
    });
    expect(result.current.rejected).toBe(true);

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current.rejected).toBe(false);
  });
});
