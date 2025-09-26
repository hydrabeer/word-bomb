import { describe, it, expect } from 'vitest';
import { generateGuestName } from './generateGuestName';

describe('generateGuestName', () => {
  it('produces Guest#### pattern', () => {
    const name = generateGuestName();
    expect(name).toMatch(/^Guest\d{4}$/);
  });
});
