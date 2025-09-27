import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import Chat from './Chat';

// Mock player profile
vi.mock('../utils/playerProfile', () => ({
  getOrCreatePlayerProfile: () => ({ id: 'u1', name: 'Alice' }),
}));

interface ChatEvtPayload {
  sender: string;
  message: string;
  timestamp: number;
  roomCode: string;
  type: 'user' | 'system';
}
type Handler = (p: ChatEvtPayload) => void;
interface MockSocket {
  on: (e: string, cb: Handler) => void;
  off: (e: string, cb: Handler) => void;
  emit: (this: void, e: string, payload: unknown) => void;
  __emitServer: (e: string, p: ChatEvtPayload) => void;
}
vi.mock('../socket', () => {
  const handlers: Record<string, Handler[]> = {};
  const emitMock = vi.fn<(e: string, payload: unknown) => void>();
  const __emitServer: MockSocket['__emitServer'] = (e, p) =>
    (handlers[e] || []).forEach((h) => h(p));
  const socket: MockSocket = {
    on: (e, cb) => {
      (handlers[e] ||= []).push(cb);
    },
    off: (e, cb) => {
      handlers[e] = (handlers[e] || []).filter((h) => h !== cb);
    },
    emit: emitMock,
    __emitServer,
  };
  return { socket, __emitServer };
});
import { socket } from '../socket';
const mockSocket = socket as unknown as MockSocket;
const emitFn = mockSocket.emit; // capture reference for expectations
const emitServer = mockSocket.__emitServer;

describe('Chat component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sends message via button and clears input', () => {
    render(<Chat roomCode="ABCD" />);
    const input = screen.getByTestId<HTMLTextAreaElement>('chat-input');
    fireEvent.change(input, { target: { value: 'Hello' } });
    const btn = screen.getByTestId('send-button');
    fireEvent.click(btn);
    expect(emitFn).toHaveBeenCalledWith(
      'chatMessage',
      expect.objectContaining({ message: 'Hello' }),
    );
    expect(input.value).toBe('');
  });

  it('submits on Enter but allows Shift+Enter', () => {
    render(<Chat roomCode="ABCD" />);
    const input = screen.getByTestId<HTMLTextAreaElement>('chat-input');
    fireEvent.change(input, { target: { value: 'One' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(emitFn).toHaveBeenCalledTimes(1);
    fireEvent.change(input, { target: { value: 'Two' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    // No extra emit for shift-enter
    expect(emitFn).toHaveBeenCalledTimes(1);
  });

  it('renders incoming message', () => {
    render(<Chat roomCode="ABCD" />);
    act(() => {
      emitServer('chatMessage', {
        sender: 'Bob',
        message: 'Hi',
        timestamp: Date.now(),
        roomCode: 'ABCD',
        type: 'user',
      });
    });
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('Hi')).toBeTruthy();
  });

  it('shows alert and does not emit when message invalid (too long)', () => {
    const alertSpy = vi
      .spyOn(window, 'alert')
      .mockImplementation((msg?: unknown) => void msg);
    render(<Chat roomCode="ABCD" />);
    const input = screen.getByTestId<HTMLTextAreaElement>('chat-input');
    const longMsg = 'x'.repeat(301);
    // Programmatically set value beyond maxLength to trigger zod failure
    fireEvent.change(input, { target: { value: longMsg } });
    const btn = screen.getByTestId('send-button');
    fireEvent.click(btn);
    expect(alertSpy).toHaveBeenCalled();
    expect(emitFn).not.toHaveBeenCalledWith(
      'chatMessage',
      expect.objectContaining({ message: longMsg }),
    );
    alertSpy.mockRestore();
  });

  it('does nothing on submit when input is empty', () => {
    render(<Chat roomCode="ABCD" />);
    const btn = screen.getByTestId('send-button');
    // Button disabled when empty
    expect(btn).toBeDisabled();
  });
});
