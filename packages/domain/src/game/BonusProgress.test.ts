import { describe, it, expect } from 'vitest';
import { BonusProgress } from './BonusProgress';

const makeTemplate = (fill: number) => Array.from({ length: 26 }, () => fill);

describe('BonusProgress', () => {
  it('throws when constructed with invalid length', () => {
    const bad: number[] = Array.from({ length: 25 }, () => 0);
    expect(() => {
      new BonusProgress(bad);
    }).toThrow('BonusProgress must have 26 entries.');
  });

  it('useLetter returns false when count is already 0', () => {
    const bp = new BonusProgress(makeTemplate(0));
    expect(bp.useLetter('a')).toBe(false);
  });

  it('handles uppercase letters and decrements properly', () => {
    const tpl = makeTemplate(0);
    tpl[1] = 2; // letter 'b'
    const bp = new BonusProgress(tpl);

    expect(bp.useLetter('B')).toBe(true); // uppercase path via toLowerCase
    expect(bp.toArray()[1]).toBe(1);
    expect(bp.useLetter('b')).toBe(true);
    expect(bp.toArray()[1]).toBe(0);
    // now exhausted
    expect(bp.useLetter('b')).toBe(false);
  });

  it('isComplete returns true when all letters are exhausted', () => {
    const bp = new BonusProgress(makeTemplate(0));
    expect(bp.isComplete()).toBe(true);
  });

  it('reset applies template and throws on invalid length', () => {
    const bp = new BonusProgress(makeTemplate(1));
    // good reset
    const next = makeTemplate(2);
    bp.reset(next);
    expect(bp.toArray()).toEqual(next);

    // bad reset length
    const bad: number[] = Array.from({ length: 25 }, () => 0);
    expect(() => {
      bp.reset(bad);
    }).toThrow('Invalid template for reset.');
  });
});
