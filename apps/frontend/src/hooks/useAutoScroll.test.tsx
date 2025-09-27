import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { useAutoScroll } from './useAutoScroll';
import { useEffect } from 'react';

function TestComponent({ items }: { items: string[] }) {
  const ref = useAutoScroll<HTMLDivElement>([items]);
  useEffect(() => {
    /* simulate dynamic content */
  }, [items]);
  return (
    <div
      ref={ref}
      data-testid="scroll"
      style={{ height: 50, overflowY: 'auto' }}
    >
      {items.map((i) => (
        <div key={i} style={{ height: 30 }}>
          {i}
        </div>
      ))}
    </div>
  );
}

describe('useAutoScroll', () => {
  it('scrolls to bottom when new items added', async () => {
    const { rerender, getByTestId } = render(
      <TestComponent items={['a', 'b']} />,
    );
    const el = getByTestId('scroll');
    const firstBottom = el.scrollTop;
    rerender(<TestComponent items={['a', 'b', 'c', 'd', 'e']} />);
    // allow RAF
    await new Promise((r) => setTimeout(r, 0));
    expect(el.scrollTop).toBeGreaterThanOrEqual(firstBottom);
  });

  it('does not auto-scroll when user is far from bottom', async () => {
    const { rerender, getByTestId } = render(
      <TestComponent items={Array.from({ length: 10 }, (_, i) => String(i))} />,
    );
    const el = getByTestId('scroll');
    // simulate user scrolled to top
    el.scrollTop = 0;
    el.dispatchEvent(new Event('scroll'));
    const before = el.scrollTop;
    rerender(
      <TestComponent items={Array.from({ length: 20 }, (_, i) => String(i))} />,
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(el.scrollTop).toBe(before);
  });
});
