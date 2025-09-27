import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRoomActions } from './useRoomActions';

vi.mock('../api/rooms', () => ({
  createRoom: vi.fn(() => Promise.resolve({ code: 'NEW123' })),
  checkRoomExists: vi.fn((code: string) =>
    Promise.resolve(
      code === 'OK' ? { exists: true, name: 'Room OK' } : { exists: false },
    ),
  ),
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

    let res: { exists: boolean } | { exists: false } = { exists: false };
    await act(async () => {
      res = await result.current.validateRoom('OK');
    });
    expect(res.exists).toBe(true);
    expect(api.checkRoomExists).toHaveBeenCalledWith('OK');

    await act(async () => {
      res = await result.current.validateRoom('NOPE');
    });
    expect(res.exists).toBe(false);
  });
});
