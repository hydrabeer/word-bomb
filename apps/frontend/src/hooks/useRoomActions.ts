import { createRoom, checkRoomExists } from '../api/rooms';

/**
 * Handles pure room HTTP operations (does not deal with socket or navigation).
 */
export function useRoomActions() {
  async function createNewRoom(name?: string): Promise<string> {
    const { code } = await createRoom(name);
    return code;
  }

  async function validateRoom(
    code: string,
  ): Promise<{ exists: boolean; name: string } | { exists: false }> {
    return await checkRoomExists(code);
  }

  return { createNewRoom, validateRoom };
}
