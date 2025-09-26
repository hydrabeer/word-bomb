import { describe, it, expect } from 'vitest';
import { formatMessage } from './formatMessage';

describe('formatMessage', () => {
  it('linkifies http URLs', () => {
    const html = formatMessage('Check http://example.com');
    expect(html).toMatch(/href="https?:\/\/example.com"/);
  });

  it('escapes javascript: (no link created)', () => {
    const html = formatMessage('javascript:alert(1)');
    // linkify-html should not create an anchor for non-urls
    expect(html).not.toMatch(/<a/);
  });
});
