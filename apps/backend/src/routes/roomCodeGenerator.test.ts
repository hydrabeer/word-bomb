import { describe, expect, it } from 'vitest';

import { createRoomCodeGenerator } from './roomCodeGenerator';

describe('createRoomCodeGenerator', () => {
  it('throws when alphabet is empty', () => {
    expect(() => createRoomCodeGenerator(() => 0.1, '')).toThrow(
      'Alphabet must contain at least one character',
    );
  });

  it('throws when code length is not positive', () => {
    expect(() => createRoomCodeGenerator(() => 0.1, 'ABC', 0)).toThrow(
      'Code length must be positive',
    );
  });

  it('generates a code using the provided random function and parameters', () => {
    const randomValues = [0.0, 0.21, 0.45, 0.61, 0.81];
    const random = () => {
      const value = randomValues.shift() ?? 0;
      return value;
    };

    const generator = createRoomCodeGenerator(random, 'ABCDE', 5);

    expect(generator()).toBe('ABCDE');
  });

  it('falls back to the first alphabet character when random points outside the alphabet', () => {
    const generator = createRoomCodeGenerator(() => 1, 'XYZ', 3);

    expect(generator()).toBe('XXX');
  });
});
