const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export async function createRoom(): Promise<{ code: string }> {
  const res = await fetch(BACKEND_URL + "/api/rooms", {
    method: "POST",
  });

  if (!res.ok) throw new Error("Failed to create room");
  return res.json();
}

export async function checkRoomExists(code: string): Promise<boolean> {
  const res = await fetch(BACKEND_URL + `/api/rooms/${code}`);
  return res.ok;
}
