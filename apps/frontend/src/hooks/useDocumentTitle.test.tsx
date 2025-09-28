import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useDocumentTitle } from './useDocumentTitle';

function TitleHarness({ title }: { title?: string | null }) {
  useDocumentTitle(title);
  return null;
}

describe('useDocumentTitle', () => {
  beforeEach(() => {
    document.title = 'Initial Title';
  });

  it('updates document.title when provided with a string', () => {
    const { rerender: trigger } = render(<TitleHarness title="Alpha" />);
    expect(document.title).toBe('Alpha');

    trigger(<TitleHarness title="Beta" />);
    expect(document.title).toBe('Beta');
  });

  it('ignores undefined or null values', () => {
    const { rerender } = render(<TitleHarness title={null} />);
    expect(document.title).toBe('Initial Title');

    rerender(<TitleHarness title={undefined} />);
    expect(document.title).toBe('Initial Title');
  });
});
