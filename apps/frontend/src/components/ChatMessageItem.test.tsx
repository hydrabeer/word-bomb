import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatMessageItem } from './ChatMessageItem';
import type { ChatMessagePayload } from '@word-bomb/types/socket';

// (Optional) stabilize time-dependent formatting
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
});

const mkMsg = (
  overrides: Partial<ChatMessagePayload> = {},
): ChatMessagePayload => ({
  roomCode: 'ABCD',
  sender: 'Bob',
  message: 'hello world',
  timestamp: Date.now(),
  type: 'user',
  ...overrides,
});

describe('ChatMessageItem', () => {
  it('renders system message variant and linkifies', () => {
    render(
      <ChatMessageItem
        msg={mkMsg({ type: 'system', message: 'Visit https://example.com' })}
      />,
    );
    const sys = screen.getByTestId('system-message');
    expect(sys).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /example.com/i });
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('renders user message and respects isCurrentUser alignment', () => {
    render(<ChatMessageItem msg={mkMsg()} isCurrentUser />);
    const user = screen.getByTestId('user-message');
    expect(user).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('does not linkify plain words without protocol or www', () => {
    render(<ChatMessageItem msg={mkMsg({ message: 'example.com' })} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
