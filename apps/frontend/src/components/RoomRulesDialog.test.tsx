import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { RoomRulesDialog } from './RoomRulesDialog';
import type { LobbyRules, BasicResponse } from '../hooks/useRoomRules';

const createRules = (overrides: Partial<LobbyRules> = {}): LobbyRules => {
  const { bonusTemplate = new Array<number>(26).fill(1), ...rest } = overrides;
  return {
    maxLives: 3,
    startingLives: 2,
    bonusTemplate: [...bonusTemplate],
    minTurnDuration: 5,
    minWordsPerPrompt: 100,
    ...rest,
  };
};

type RoomRulesDialogProps = ComponentProps<typeof RoomRulesDialog>;

const createDialogProps = (
  overrides: Partial<RoomRulesDialogProps> = {},
): RoomRulesDialogProps => ({
  open: true,
  onClose: vi.fn(),
  rules: createRules(),
  isLeader: true,
  isUpdating: false,
  serverError: null,
  onSave: vi.fn().mockResolvedValue({ success: true }),
  ...overrides,
});

const renderDialog = (overrides?: Partial<RoomRulesDialogProps>) => {
  const props = createDialogProps(overrides);
  return { props, ...render(<RoomRulesDialog {...props} />) };
};

describe('RoomRulesDialog', () => {
  it('returns null when closed', () => {
    const { container } = renderDialog({ open: false });
    expect(container.firstChild).toBeNull();
  });

  it('renders and allows toggling letters and set-all actions', async () => {
    const onSave = vi
      .fn<(next: LobbyRules) => Promise<BasicResponse>>()
      .mockResolvedValue({ success: true });

    renderDialog({ onSave });
    const user = userEvent.setup({ delay: null });

    // Interact with the dialog controls: enable/disable all and toggle A via
    // the rendered grid inputs/buttons.
    fireEvent.click(screen.getByRole('button', { name: /Enable all/i }));

    // Find the button for letter A (first letter) and toggle it
    const letterButton = screen.getByRole('button', {
      name: /Disable letter A|Enable letter A/,
    });
    fireEvent.click(letterButton);

    // Click Disable all to ensure the action works
    fireEvent.click(screen.getByRole('button', { name: /Disable all/i }));

    const form = document.querySelector('form');
    expect(form).not.toBeNull();
    const save = screen.getByRole('button', { name: /Save changes/i });
    await user.click(save);

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('shows validation error when startingLives > maxLives and handles server error', async () => {
    const onSave = vi
      .fn<(next: LobbyRules) => Promise<BasicResponse>>()
      .mockResolvedValue({ success: false, error: 'Server said nope' });

    const { getByLabelText } = renderDialog({
      rules: createRules({ startingLives: 5 }),
      onSave,
    });
    const user = userEvent.setup({ delay: null });

    await user.click(screen.getByRole('button', { name: /Save changes/i }));
    expect(
      screen.getByText('Starting lives cannot exceed max lives.'),
    ).toBeInTheDocument();

    // Fix validation with userEvent for realism (and still fast)
    const maxLives = getByLabelText('Max lives') as HTMLInputElement;
    await user.clear(maxLives);
    await user.type(maxLives, '6');

    await user.click(screen.getByRole('button', { name: /Save changes/i }));
    await screen.findByText('Server said nope');
    expect(onSave).toHaveBeenCalled();
  });

  it('allows editing numeric bonus values and submits updated template', async () => {
    const onSave = vi
      .fn<(next: LobbyRules) => Promise<BasicResponse>>()
      .mockResolvedValue({ success: true });

    renderDialog({ onSave });
    const user = userEvent.setup({ delay: null });

    // Locate the tile for letter 'A' and its numeric input. This is more
    // robust than assuming ordering of spinbuttons.
    const aTile = screen.getByText('A');
    const aTileContainer = aTile.closest('div')!;
    const aInput = within(aTileContainer).getByRole('spinbutton');
    await user.clear(aInput);
    await user.type(aInput, '3');

    await user.click(screen.getByRole('button', { name: /Save changes/i }));

    expect(onSave).toHaveBeenCalled();

    const calledWith = onSave.mock.calls[0][0];
    expect(calledWith.bonusTemplate[0]).toBe(3);
  });

  it('closes via Escape and overlay click, and respects isLeader/isUpdating disabling', () => {
    const onClose = vi.fn();
    const utils = renderDialog({
      onClose,
      rules: createRules(),
      isLeader: false,
      isUpdating: true,
      serverError: 'Delayed error',
    });

    expect(screen.getByText('Delayed error')).toBeInTheDocument();

    // Escape closes
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    utils.rerender(
      <RoomRulesDialog
        {...createDialogProps({
          onClose,
          rules: createRules(),
          isLeader: false,
          isUpdating: true,
        })}
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
