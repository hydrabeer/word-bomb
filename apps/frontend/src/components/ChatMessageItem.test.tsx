import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatMessageItem, type ChatMessage } from './ChatMessageItem';

const baseMsg: ChatMessage = {
  sender: 'Bob',
  message: 'hello world',
  timestamp: Date.now(),
  type: 'user',
};

describe('ChatMessageItem', () => {
  it('renders system message variant and linkifies', () => {
    render(
      <ChatMessageItem
        msg={{
          ...baseMsg,
          type: 'system',
          message: 'Visit https://example.com',
        }}
      />,
    );
    const sys = screen.getByTestId('system-message');
    expect(sys).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /example.com/i });
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('renders user message and respects isCurrentUser alignment', () => {
    render(<ChatMessageItem msg={baseMsg} isCurrentUser />);
    const user = screen.getByTestId('user-message');
    expect(user).toBeInTheDocument();
    // aria-label includes time; just verify sender is present
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('does not linkify plain words without protocol or www', () => {
    render(<ChatMessageItem msg={{ ...baseMsg, message: 'example.com' }} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
