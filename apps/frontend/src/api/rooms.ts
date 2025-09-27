const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export async function createRoom(name?: string): Promise<{ code: string }> {
  const res = await fetch(BACKEND_URL + '/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) throw new Error('Failed to create room');
  return (await res.json()) as { code: string };
}

export async function checkRoomExists(
  code: string,
): Promise<{ exists: boolean; name: string } | { exists: false; name?: '' }> {
  const res = await fetch(BACKEND_URL + `/api/rooms/${code}`);
  if (!res.ok) return { exists: false };
  const data = (await res.json()) as { exists: boolean; name?: string };
  return { exists: true, name: data.name ?? '' };
}
