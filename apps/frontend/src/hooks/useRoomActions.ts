import { createRoom, checkRoomExists, type RoomVisibility } from '../api/rooms';

/**
 * Handles pure room HTTP operations (does not deal with socket or navigation).
 */
export function useRoomActions() {
  async function createNewRoom(
    name?: string,
    visibility: RoomVisibility = 'private',
  ): Promise<string> {
    const { code } = await createRoom(name, visibility);
    return code;
  }

  async function validateRoom(
    code: string,
  ): Promise<{ exists: boolean; name: string } | { exists: false }> {
    return await checkRoomExists(code);
  }

  return { createNewRoom, validateRoom };
}
