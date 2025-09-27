import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RoomRulesDialog } from './RoomRulesDialog';
import type { LobbyRules, BasicResponse } from '../hooks/useRoomRules';

const rules: LobbyRules = {
  maxLives: 3,
  startingLives: 2,
  bonusTemplate: Array.from({ length: 26 }, () => 1),
  minTurnDuration: 5,
  minWordsPerPrompt: 100,
};

describe('RoomRulesDialog', () => {
  it('returns null when closed', () => {
    const { container } = render(
      <RoomRulesDialog
        open={false}
        onClose={vi.fn()}
        rules={rules}
        isLeader={true}
        isUpdating={false}
        serverError={null}
        onSave={() => Promise.resolve({ success: true })}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders and allows toggling letters and set-all actions', async () => {
    const onSave = vi
      .fn<(next: LobbyRules) => Promise<BasicResponse>>()
      .mockResolvedValue({
        success: true,
      });
    const onClose = vi.fn();
    const { container } = render(
      <RoomRulesDialog
        open
        onClose={onClose}
        rules={rules}
        isLeader={true}
        isUpdating={false}
        serverError={null}
        onSave={onSave}
      />,
    );

    // Toggle a letter by querying a letter button (A)
    const letterButtons = screen.getAllByRole('button');
    // find a letter button by text content length 1
    const letterButton =
      letterButtons.find((b) => b.textContent && b.textContent.length === 1) ??
      letterButtons[0];
    fireEvent.click(letterButton);

    // Use set-all buttons
    fireEvent.click(screen.getByRole('button', { name: 'Enable all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Disable all' }));

    // Submit valid form via submit button
    const form = container.querySelector('form')!;
    fireEvent.submit(form);
    // ensure onSave was called
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });

  it('shows validation error when startingLives > maxLives and handles server error', async () => {
    const onSave = vi
      .fn<(next: LobbyRules) => Promise<BasicResponse>>()
      .mockResolvedValue({ success: false, error: 'Server said nope' });
    const { getByLabelText, container } = render(
      <RoomRulesDialog
        open
        onClose={vi.fn()}
        rules={{ ...rules, startingLives: 5 }}
        isLeader={true}
        isUpdating={false}
        serverError={null}
        onSave={onSave}
      />,
    );
    // Increase maxLives input lower than startingLives to trigger validation
    const form = container.querySelector('form')!;
    fireEvent.submit(form);
    await screen.findByText('Starting lives cannot exceed max lives.');

    // Fix validation then submit to see submitError displayed
    const maxLives = getByLabelText('Max lives');
    fireEvent.change(maxLives, { target: { value: '6' } });
    fireEvent.submit(form);
    // wait for async save error to render
    await screen.findByText('Server said nope');
    expect(onSave).toHaveBeenCalled();
    expect(screen.getByText('Server said nope')).toBeInTheDocument();
  });

  it('closes via Escape and overlay click, and respects isLeader/isUpdating disabling', () => {
    const onClose = vi.fn();
    const first = render(
      <RoomRulesDialog
        open
        onClose={onClose}
        rules={rules}
        isLeader={false}
        isUpdating={true}
        serverError={'Delayed error'}
        onSave={() => Promise.resolve({ success: true })}
      />,
    );

    // serverError is shown
    expect(screen.getByText('Delayed error')).toBeInTheDocument();

    // Escape key closes
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    // Unmount then render again to test overlay click without duplicates
    const { unmount } = first;
    unmount();
    onClose.mockClear();
    render(
      <RoomRulesDialog
        open
        onClose={onClose}
        rules={rules}
        isLeader={false}
        isUpdating={true}
        serverError={null}
        onSave={() => Promise.resolve({ success: true })}
      />,
    );

    const overlay = screen.getAllByRole('dialog')[0];
    fireEvent.click(overlay); // click overlay itself to trigger onClose
    expect(onClose).toHaveBeenCalledTimes(1);

    // Controls disabled when not leader or updating
    const inputs = screen.getAllByRole('spinbutton');
    inputs.forEach((inp) => {
      expect((inp as HTMLInputElement).disabled).toBe(true);
    });
  });
});
