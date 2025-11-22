import { useCallback, useEffect, useRef, useState } from 'react';
import { listPublicRooms, type RoomSummary } from '../api/rooms';

interface UsePublicRoomsResult {
  rooms: RoomSummary[];
  isLoading: boolean;
  hasError: boolean;
  refresh: () => Promise<void>;
}

/**
 * Fetches the lobby list once on mount and exposes a refresh helper.
 * Keeps local state lean so callers only worry about rendering.
 */
export function usePublicRooms(): UsePublicRoomsResult {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const isMountedRef = useRef(true);

  const refresh = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const lobby = await listPublicRooms();
      if (isMountedRef.current) {
        setRooms(lobby.filter((room) => room.visibility === 'public'));
        setHasError(false);
      }
    } catch {
      if (isMountedRef.current) {
        setRooms([]);
        setHasError(true);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void refresh();
    return () => {
      isMountedRef.current = false;
    };
  }, [refresh]);

  return { rooms, isLoading, hasError, refresh };
}
