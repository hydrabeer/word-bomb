import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  fireEvent,
  screen,
  waitFor,
  createEvent,
} from '@testing-library/react';

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
const { mockListPublicRooms } = vi.hoisted(() => ({
  mockListPublicRooms: vi.fn().mockResolvedValue([]),
}));

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

vi.mock('../api/rooms', () => ({
  listPublicRooms: mockListPublicRooms,
}));

describe('HomePage', () => {
  beforeEach(() => {
    document.title = 'Initial Title';
    mockNavigate.mockReset();
    mockCreateNewRoom.mockReset();
    mockCreateNewRoom.mockResolvedValue('ROOM');
    mockValidateRoom.mockReset();
    mockValidateRoom.mockResolvedValue({ exists: true, name: 'Room' });
    mockListPublicRooms.mockReset();
    mockListPublicRooms.mockResolvedValue([]);
  });

  const setup = async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(mockListPublicRooms).toHaveBeenCalled();
    });
  };

  it('sets the base document title on mount', async () => {
    await setup();
    await waitFor(() => {
      expect(document.title).toBe('Word Bomb');
    });
  });

  it('edits and saves name', async () => {
    await setup();
    fireEvent.click(screen.getByLabelText(/Edit your name/i));
    const input = screen.getByLabelText(/Your display name/i);
    fireEvent.change(input, { target: { value: 'Bob' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('creates room and navigates', async () => {
    await setup();
    const createBtn = screen.getByLabelText(/Create a new game room/i);
    fireEvent.click(createBtn);
    await waitFor(() => {
      expect(mockCreateNewRoom).toHaveBeenCalledWith("Alice's room", 'private');
      expect(mockNavigate).toHaveBeenCalledWith('/ROOM');
    });
  });

  it('keeps a custom room name when saving a new profile name', async () => {
    await setup();
    const roomNameInput = screen.getByLabelText(/Room name/i);
    fireEvent.change(roomNameInput, { target: { value: 'Cool Club' } });
    fireEvent.click(screen.getByLabelText(/Edit your name/i));
    const nameInput = screen.getByLabelText(/Your display name/i);
    fireEvent.change(nameInput, { target: { value: 'Bob' } });
    fireEvent.click(screen.getByLabelText(/Save name/i));
    expect((roomNameInput as HTMLInputElement).value).toBe('Cool Club');
  });

  it('does not create a room when pressing Enter in the room name field', async () => {
    await setup();
    const roomNameInput = screen.getByLabelText<HTMLInputElement>(/Room name/i);
    const blurSpy = vi.spyOn(roomNameInput, 'blur');
    const event = createEvent.keyDown(roomNameInput, { key: 'Enter' });
    const preventDefault = vi.spyOn(event, 'preventDefault');

    fireEvent(roomNameInput, event);

    await waitFor(() => {
      expect(mockCreateNewRoom).not.toHaveBeenCalled();
      expect(preventDefault).toHaveBeenCalled();
      expect(blurSpy).toHaveBeenCalled();
    });

    blurSpy.mockRestore();
  });

  it('allows setting room visibility before creating a room', async () => {
    await setup();
    const publicOption = screen.getByRole('radio', { name: /^Public room$/i });
    fireEvent.click(publicOption);
    const createBtn = screen.getByLabelText(/Create a new game room/i);
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(mockCreateNewRoom).toHaveBeenCalledWith("Alice's room", 'public');
    });
  });

  it('sanitizes join code input and enables join', async () => {
    await setup();
    const joinInput = screen.getByLabelText(/Room code/i);
    fireEvent.change(joinInput, { target: { value: 'a1b!' } });
    expect((joinInput as HTMLInputElement).value).toBe('AB');
  });

  it('navigates to the room when validation succeeds', async () => {
    await setup();
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

    await setup();
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

  it('displays encouraging message when there are no public rooms', async () => {
    await setup();
    expect(await screen.findByText(/No public rooms yet/i)).toBeTruthy();
  });

  it('renders public rooms and navigates when a card is clicked', async () => {
    mockListPublicRooms.mockResolvedValueOnce([
      { code: 'ABCD', name: 'Lobby', playerCount: 3, visibility: 'public' },
    ]);

    await setup();

    const roomButton = await screen.findByRole('button', {
      name: /Join Lobby/i,
    });
    fireEvent.click(roomButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/ABCD');
    });
  });

  it('shows an error message when public rooms cannot be loaded', async () => {
    mockListPublicRooms.mockRejectedValueOnce(new Error('network'));

    await setup();

    expect(
      await screen.findByText(/Unable to load public rooms right now/i),
    ).toBeTruthy();
  });
});
