import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRoomActions } from './useRoomActions';

vi.mock('../api/rooms', () => ({
  createRoom: vi.fn(() => Promise.resolve({ code: 'NEW123' })),
  checkRoomExists: vi.fn((code: string) => Promise.resolve(code === 'OK')),
}));

import * as api from '../api/rooms';

describe('useRoomActions', () => {
  it('creates and validates rooms', async () => {
    const { result } = renderHook(() => useRoomActions());

    let code = '';
    await act(async () => {
      code = await result.current.createNewRoom();
    });
    expect(code).toBe('NEW123');
    expect(api.createRoom).toHaveBeenCalledTimes(1);

    let ok = false;
    await act(async () => {
      ok = await result.current.validateRoom('OK');
    });
    expect(ok).toBe(true);
    expect(api.checkRoomExists).toHaveBeenCalledWith('OK');

    await act(async () => {
      ok = await result.current.validateRoom('NOPE');
    });
    expect(ok).toBe(false);
  });
});
