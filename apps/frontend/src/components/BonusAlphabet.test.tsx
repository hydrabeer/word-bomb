import { render, screen } from '@testing-library/react';
import { BonusAlphabet } from './BonusAlphabet';

describe('BonusAlphabet', () => {
  const baseProgress = (opts?: Partial<{ rem: number[]; tot: number[] }>) => {
    const total = new Array(26).fill(0);
    // require A twice, B once, C zero (inactive), D once but already completed
    total[0] = 2; // A
    total[1] = 1; // B
    total[3] = 1; // D
    const remaining = total.slice();
    // simulate one A done (remaining 1), B not done (1), D done (0)
    remaining[0] = 1;
    remaining[1] = 1;
    remaining[3] = 0;
    return { remaining: opts?.rem ?? remaining, total: opts?.tot ?? total };
  };

  it('renders only active letters (total>0) and shows counters when total>1 and remaining>0', () => {
    render(
      <BonusAlphabet
        progress={baseProgress()}
        settings={{ showNumbers: true }}
      />,
    );
    // Renders only letters with total>0: A, B, D (C is inactive with total=0)
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
    expect(screen.queryByText('C')).toBeNull();
    // Only A has total>1 and remaining>0 -> at least one '1' counter exists
    const counters = screen.getAllByText('1');
    expect(counters.length).toBeGreaterThanOrEqual(1);
  });

  it('greys out completed or inactive letters and hides counter at 0', () => {
    render(<BonusAlphabet progress={baseProgress()} />);
    const dTile = screen.getByText('D').parentElement!;
    expect(dTile.getAttribute('style') || '').toContain('grayscale(100%)');
    // Inactive C is not rendered at all (total=0)
    expect(screen.queryByText('C')).toBeNull();
    // D has remaining 0 -> no counter element
    expect(screen.queryByText('(0)')).toBeNull();
  });
});
