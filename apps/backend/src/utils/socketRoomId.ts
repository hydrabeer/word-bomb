/**
 * Converts a game room code into the Socket.IO room identifier namespace.
 *
 * @param code Raw alphanumeric room code.
 * @returns Socket room id in the `room:<code>` format.
 */
export function socketRoomId(code: string): string {
  return `room:${code}`;
}
