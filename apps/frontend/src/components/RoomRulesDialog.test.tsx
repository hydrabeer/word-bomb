import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoomRulesDialog } from './RoomRulesDialog';
import type { LobbyRules, BasicResponse } from '../hooks/useRoomRules';

const rules: LobbyRules = {
  maxLives: 3,
  startingLives: 2,
  bonusTemplate: new Array<number>(26).fill(1),
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
        isLeader
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
      .mockResolvedValue({ success: true });

    const { container } = render(
      <RoomRulesDialog
        open
        onClose={vi.fn()}
        rules={rules}
        isLeader
        isUpdating={false}
        serverError={null}
        onSave={onSave}
      />,
    );

    // Interact with the dialog controls: enable/disable all and toggle A via
    // the rendered grid inputs/buttons.
    // Click the Enable all button in the dialog header
    screen.getByRole('button', { name: /Enable all/i }).click();

    // Find the button for letter A (first letter) and toggle it
    const letterButton = screen.getByRole('button', {
      name: /Disable letter A|Enable letter A/,
    });
    letterButton.click();

    // Click Disable all to ensure the action works
    screen.getByRole('button', { name: /Disable all/i }).click();

    const form = container.querySelector('form')!;
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );

    await Promise.resolve(); // microtask
    expect(onSave).toHaveBeenCalledTimes(1);
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
        isLeader
        isUpdating={false}
        serverError={null}
        onSave={onSave}
      />,
    );

    const form = container.querySelector('form')!;
    fireEvent.submit(form);
    expect(
      screen.getByText('Starting lives cannot exceed max lives.'),
    ).toBeInTheDocument();

    // Fix validation with userEvent for realism (and still fast)
    const user = userEvent.setup({ delay: null });
    const maxLives = getByLabelText('Max lives') as HTMLInputElement;
    await user.clear(maxLives);
    await user.type(maxLives, '6');

    fireEvent.submit(form);
    await screen.findByText('Server said nope');
    expect(onSave).toHaveBeenCalled();
  });

  it('allows editing numeric bonus values and submits updated template', async () => {
    const onSave = vi
      .fn<(next: LobbyRules) => Promise<BasicResponse>>()
      .mockResolvedValue({ success: true });

    const { container } = render(
      <RoomRulesDialog
        open
        onClose={vi.fn()}
        rules={rules}
        isLeader
        isUpdating={false}
        serverError={null}
        onSave={onSave}
      />,
    );

    // Locate the tile for letter 'A' and its numeric input. This is more
    // robust than assuming ordering of spinbuttons.
    const aTile = screen.getByText('A');
    const aTileContainer = aTile.closest('div')!;
    const aInput = within(aTileContainer).getByRole('spinbutton');
    const user = userEvent.setup({ delay: null });
    await user.clear(aInput);
    await user.type(aInput, '3');

    const form = container.querySelector('form')!;
    fireEvent.submit(form);
    await Promise.resolve();

    expect(onSave).toHaveBeenCalled();
    const calledWith = onSave.mock.calls[0][0];
    expect(calledWith.bonusTemplate[0]).toBe(3);
  });

  it('closes via Escape and overlay click, and respects isLeader/isUpdating disabling', () => {
    const onClose = vi.fn();
    const first = render(
      <RoomRulesDialog
        open
        onClose={onClose}
        rules={rules}
        isLeader={false}
        isUpdating
        serverError="Delayed error"
        onSave={() => Promise.resolve({ success: true })}
      />,
    );

    expect(screen.getByText('Delayed error')).toBeInTheDocument();

    // Escape closes
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    // Re-render to test overlay click without double-binding
    const { unmount } = first;
    unmount();
    onClose.mockClear();

    render(
      <RoomRulesDialog
        open
        onClose={onClose}
        rules={rules}
        isLeader={false}
        isUpdating
        serverError={null}
        onSave={() => Promise.resolve({ success: true })}
      />,
    );

    // If your dialog root has data-testid, prefer querying it; otherwise:
    const overlay = screen.getAllByRole('dialog')[0];
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Inputs disabled when not leader or updating
    screen.getAllByRole('spinbutton').forEach((inp) => {
      expect((inp as HTMLInputElement).disabled).toBe(true);
    });

    expect(screen.getByText('Saving…')).toBeInTheDocument();
  });
});
