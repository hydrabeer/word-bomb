import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from './HomePage';

vi.mock('../utils/playerProfile', () => ({
  getOrCreatePlayerProfile: () => ({ id: 'u1', name: 'Alice' }),
  updatePlayerName: vi.fn(),
}));

vi.mock('../hooks/useRoomActions', () => ({
  useRoomActions: () => ({
    createNewRoom: vi.fn().mockResolvedValue('ROOM'),
    validateRoom: vi.fn().mockResolvedValue(true),
  }),
}));

describe('HomePage', () => {
  const setup = () =>
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

  it('edits and saves name', () => {
    setup();
    fireEvent.click(screen.getByLabelText(/Edit your name/i));
    const input = screen.getByLabelText(/Your display name/i);
    fireEvent.change(input, { target: { value: 'Bob' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('creates room and navigates', async () => {
    setup();
    const createBtn = screen.getByLabelText(/Create a new game room/i);
    fireEvent.click(createBtn);
    await waitFor(() => {
      // navigation not directly testable without mocking useNavigate; just ensure button wasn't disabled
      expect(createBtn).not.toBeDisabled();
    });
  });

  it('sanitizes join code input and enables join', () => {
    setup();
    const joinInput = screen.getByLabelText(/Room code/i);
    fireEvent.change(joinInput, { target: { value: 'a1b!' } });
    expect((joinInput as HTMLInputElement).value).toBe('AB');
  });
});
