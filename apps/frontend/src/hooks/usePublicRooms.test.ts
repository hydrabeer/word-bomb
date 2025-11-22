import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StrictMode, createElement, type ReactNode } from 'react';
import { usePublicRooms } from './usePublicRooms';
import { listPublicRooms } from '../api/rooms';

vi.mock('../api/rooms', () => ({
  listPublicRooms: vi.fn(),
}));

const listPublicRoomsMock = vi.mocked(listPublicRooms);

describe('usePublicRooms', () => {
  beforeEach(() => {
    listPublicRoomsMock.mockReset();
  });

  const strictModeWrapper = ({ children }: { children: ReactNode }) =>
    createElement(StrictMode, null, children);

  it('loads public rooms on mount and filters visibility', async () => {
    listPublicRoomsMock.mockResolvedValueOnce([
      { code: 'AAAA', name: 'Public', playerCount: 3, visibility: 'public' },
      { code: 'BBBB', name: 'Private', playerCount: 1, visibility: 'private' },
    ]);

    const { result } = renderHook(() => usePublicRooms(), {
      wrapper: strictModeWrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(listPublicRoomsMock).toHaveBeenCalledTimes(1);
    expect(result.current.rooms).toEqual([
      { code: 'AAAA', name: 'Public', playerCount: 3, visibility: 'public' },
    ]);
    expect(result.current.hasError).toBe(false);
  });

  it('exposes refresh and surfaces errors', async () => {
    listPublicRoomsMock.mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() => usePublicRooms(), {
      wrapper: strictModeWrapper,
    });

    await waitFor(() => {
      expect(result.current.hasError).toBe(true);
    });
    expect(result.current.rooms).toEqual([]);

    listPublicRoomsMock.mockResolvedValueOnce([
      { code: 'CCCC', name: 'Again', playerCount: 2, visibility: 'public' },
    ]);

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.hasError).toBe(false);
    expect(result.current.rooms[0]?.code).toBe('CCCC');
  });
});
