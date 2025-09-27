const DEFAULT_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DEFAULT_CODE_LENGTH = 4;

export type RoomCodeGenerator = () => string;

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
