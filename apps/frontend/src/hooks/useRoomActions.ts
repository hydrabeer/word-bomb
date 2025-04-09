import { createRoom, checkRoomExists } from "../api/rooms";

/**
 * Handles pure room HTTP operations (does not deal with socket or navigation).
 */
export function useRoomActions() {
  async function createNewRoom(): Promise<string> {
    const { code } = await createRoom();
    return code;
  }

  async function validateRoom(code: string): Promise<boolean> {
    return await checkRoomExists(code);
  }

  return { createNewRoom, validateRoom };
}
