import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PlayerBubble } from './PlayerBubble';

describe('PlayerBubble', () => {
  const basePlayer = {
    id: 'p1',
    name: 'Alice',
    isEliminated: false,
    lives: 2,
    isConnected: true,
  } as const;
  it('renders hearts, name, and highlighted text with flash/shake states', () => {
    const { container, rerender } = render(
      <PlayerBubble
        player={basePlayer}
        isActive={true}
        isEliminated={false}
        x={0}
        y={0}
        highlighted={'Hello'}
        isUrgent={true}
        flash={true}
        shake={true}
        rotation={10}
      />,
    );
    // should render two hearts
    expect(container.textContent).toContain('❤️');
    // highlighted text visible
    expect(container.textContent).toContain('Hello');
    // rerender as eliminated to cover skull branch
    rerender(
      <PlayerBubble
        player={{ ...basePlayer, isEliminated: true, lives: 0 }}
        isActive={false}
        isEliminated={true}
        x={0}
        y={0}
        highlighted={null}
        isUrgent={false}
        flash={false}
        shake={false}
      />,
    );
    expect(container.textContent).toContain('💀');
  });

  it('shows reconnecting banner when player is disconnected', () => {
    const { getByText } = render(
      <PlayerBubble
        player={{ ...basePlayer, isConnected: false }}
        isActive={false}
        isEliminated={false}
        x={0}
        y={0}
        highlighted={null}
        isUrgent={false}
        flash={false}
        shake={false}
      />,
    );
    expect(getByText('Reconnecting…')).toBeInTheDocument();
  });
});
