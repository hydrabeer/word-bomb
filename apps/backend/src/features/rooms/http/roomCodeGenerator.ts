const DEFAULT_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DEFAULT_CODE_LENGTH = 4;

/**
 * Signature for functions that produce unique, human-readable room codes.
 */
export type RoomCodeGenerator = () => string;

/**
 * Builds a room code generator using the provided random source and alphabet.
 *
 * @param random Random number generator returning values in `[0, 1)`.
 * @param alphabet Character set used to build individual code characters.
 * @param codeLength Total number of characters in the generated code.
 * @returns A function that yields new room codes on each invocation.
 * @throws {Error} When the alphabet is empty or the length is non-positive.
 */
export function createRoomCodeGenerator(
  random: () => number = Math.random,
  alphabet: string = DEFAULT_ALPHABET,
  codeLength: number = DEFAULT_CODE_LENGTH,
): RoomCodeGenerator {
  if (alphabet.length === 0) {
    throw new Error('Alphabet must contain at least one character');
  }
  if (codeLength <= 0) {
    throw new Error('Code length must be positive');
  }

  const fallbackChar = alphabet[0];

  return () =>
    Array.from({ length: codeLength }, () => {
      const index = Math.floor(random() * alphabet.length);
      const char = alphabet.charAt(index);
      return char || fallbackChar;
    }).join('');
}
