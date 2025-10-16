import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>(
      'react-router-dom',
    );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { MemoryRouter } from 'react-router-dom';
import HomePage from './HomePage';

const mockCreateNewRoom = vi.fn().mockResolvedValue('ROOM');
const mockValidateRoom = vi
  .fn()
  .mockResolvedValue({ exists: true, name: 'Room' });

vi.mock('../utils/playerProfile', () => ({
  getOrCreatePlayerProfile: () => ({ id: 'u1', name: 'Alice' }),
  updatePlayerName: vi.fn(),
}));

vi.mock('../hooks/useRoomActions', () => ({
  useRoomActions: () => ({
    createNewRoom: mockCreateNewRoom,
    validateRoom: mockValidateRoom,
  }),
}));

describe('HomePage', () => {
  beforeEach(() => {
    document.title = 'Initial Title';
    mockNavigate.mockReset();
    mockCreateNewRoom.mockReset();
    mockCreateNewRoom.mockResolvedValue('ROOM');
    mockValidateRoom.mockReset();
    mockValidateRoom.mockResolvedValue({ exists: true, name: 'Room' });
  });

  const setup = () =>
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

  it('sets the base document title on mount', async () => {
    setup();
    await waitFor(() => {
      expect(document.title).toBe('Word Bomb');
    });
  });

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
      expect(mockCreateNewRoom).toHaveBeenCalledWith("Alice's room");
      expect(mockNavigate).toHaveBeenCalledWith('/ROOM');
    });
  });

  it('sanitizes join code input and enables join', () => {
    setup();
    const joinInput = screen.getByLabelText(/Room code/i);
    fireEvent.change(joinInput, { target: { value: 'a1b!' } });
    expect((joinInput as HTMLInputElement).value).toBe('AB');
  });

  it('navigates to the room when validation succeeds', async () => {
    setup();
    const joinInput = screen.getByLabelText(/Room code/i);
    fireEvent.change(joinInput, { target: { value: 'abcd' } });
    const joinButton = screen.getByLabelText(/Join existing room/i);
    fireEvent.click(joinButton);
    await waitFor(() => {
      expect(mockValidateRoom).toHaveBeenCalledWith('ABCD');
      expect(mockNavigate).toHaveBeenCalledWith('/ABCD');
    });
  });

  it('alerts when the room does not exist', async () => {
    const alertSpy = vi
      .spyOn(window, 'alert')
      .mockImplementation(() => undefined);
    mockValidateRoom.mockResolvedValueOnce({ exists: false });

    setup();
    const joinInput = screen.getByLabelText(/Room code/i);
    fireEvent.change(joinInput, { target: { value: 'abcd' } });
    const joinButton = screen.getByLabelText(/Join existing room/i);
    fireEvent.click(joinButton);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Room not found: ABCD');
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    alertSpy.mockRestore();
  });
});
