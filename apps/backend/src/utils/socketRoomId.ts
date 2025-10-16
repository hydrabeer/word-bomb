/** Prefix shared by all Socket.IO rooms that back game instances. */
export const SOCKET_ROOM_PREFIX = 'room:';

/**
 * Converts a game room code into the Socket.IO room identifier namespace.
 *
 * @param code Raw alphanumeric room code.
 * @returns Socket room id in the `room:<code>` format.
 */
export function socketRoomId(code: string): string {
  return `${SOCKET_ROOM_PREFIX}${code}`;
}
