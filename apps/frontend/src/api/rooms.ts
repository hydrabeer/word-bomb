const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export type RoomVisibility = 'public' | 'private';

export interface RoomSummary {
  code: string;
  name: string;
  playerCount: number;
  visibility: RoomVisibility;
}

export interface RoomExistenceSuccess {
  exists: true;
  name: string;
  visibility: RoomVisibility;
}

export interface RoomExistenceFailure {
  exists: false;
}

export async function createRoom(
  name?: string,
  visibility: RoomVisibility = 'private',
): Promise<{ code: string }> {
  const res = await fetch(BACKEND_URL + '/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, visibility }),
  });

  if (!res.ok) throw new Error('Failed to create room');
  return (await res.json()) as { code: string };
}

export async function checkRoomExists(
  code: string,
): Promise<RoomExistenceSuccess | RoomExistenceFailure> {
  const res = await fetch(BACKEND_URL + `/api/rooms/${code}`);
  if (!res.ok) return { exists: false };
  const data = (await res.json()) as {
    exists: boolean;
    name?: string;
    visibility?: RoomVisibility;
  };
  return {
    exists: true,
    name: data.name ?? '',
    visibility: data.visibility === 'public' ? 'public' : 'private',
  };
}

export async function listPublicRooms(): Promise<RoomSummary[]> {
  const res = await fetch(BACKEND_URL + '/api/rooms?visibility=public');
  if (!res.ok) {
    throw new Error('Failed to load rooms');
  }
  const data = (await res.json()) as {
    rooms?: {
      code: string;
      name?: string;
      playerCount?: number;
      visibility?: RoomVisibility;
    }[];
  };
  return (data.rooms ?? []).map((room) => ({
    code: room.code,
    name: room.name ?? '',
    playerCount: room.playerCount ?? 0,
    visibility: room.visibility === 'public' ? 'public' : 'private',
  }));
}
