import { describe, it, expect } from 'vitest';
import { noop } from './noop';

describe('noop', () => {
  it('does not throw an error when called', () => {
    expect(() => {
      noop(); // Call noop without using its return value
    }).not.toThrow();
  });
});
