// Convert a room code into the Socket.IO room name.
export function socketRoomId(code: string): string {
  return `room:${code}`;
}
