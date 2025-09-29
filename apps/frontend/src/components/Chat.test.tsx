import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Chat from './Chat';
import type {
  ChatMessagePayload,
  ChatMessageDraft,
} from '@word-bomb/types/socket';

// Mock player profile (UI reads current user name)
vi.mock('../utils/playerProfile', () => ({
  getOrCreatePlayerProfile: () => ({ id: 'u1', name: 'Alice' }),
}));

// Socket mock
type Handler<T = unknown> = (p: T) => void;
interface MockSocket {
  on: (e: string, cb: Handler) => void;
  off: (e: string, cb: Handler) => void;
  emit: (e: string, payload: unknown) => void;
  __emitServer: (e: string, p: ChatMessagePayload) => void;
}

vi.mock('../socket', () => {
  const handlers: Record<string, Handler[]> = {};
  const emit = vi.fn<(e: string, payload: unknown) => void>();
  const __emitServer: MockSocket['__emitServer'] = (e, p) => {
    (handlers[e] ?? []).forEach((h) => h(p));
  };
  const socket: MockSocket = {
    on: (e, cb) => {
      (handlers[e] ||= []).push(cb);
    },
    off: (e, cb) => {
      handlers[e] = (handlers[e] ?? []).filter((h) => h !== cb);
    },
    emit,
    __emitServer,
  };
  return { socket, __emitServer };
});

import { socket } from '../socket';
const mockSocket = socket as unknown as MockSocket;
const emitFn = mockSocket.emit;
const emitServer = mockSocket.__emitServer;

describe('Chat component', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('sends message via button and clears input', () => {
    render(<Chat roomCode="ABCD" />);
    const input = screen.getByTestId<HTMLTextAreaElement>('chat-input');

    fireEvent.change(input, { target: { value: 'Hello' } });

    const btn = screen.getByTestId('send-button');
    fireEvent.click(btn);

    // Emits draft (no timestamp); server fills timestamp/type
    expect(emitFn).toHaveBeenCalledWith(
      'chatMessage',
      expect.objectContaining<Partial<ChatMessageDraft>>({
        roomCode: 'ABCD',
        sender: 'Alice',
        message: 'Hello',
      }),
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

  it('renders incoming message from server', () => {
    render(<Chat roomCode="ABCD" />);
    act(() => {
      emitServer('chatMessage', {
        roomCode: 'ABCD',
        sender: 'Bob',
        message: 'Hi',
        timestamp: Date.now(),
        type: 'user',
      });
    });
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Hi')).toBeInTheDocument();
  });

  it('caps input at 300 chars and emits truncated message (no alert)', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(vi.fn());

    render(<Chat roomCode="ABCD" />);
    const input = screen.getByTestId<HTMLTextAreaElement>('chat-input');

    // fastest: single-event paste, zero delay
    const user = userEvent.setup({ delay: null });
    const tooLong = 'x'.repeat(301);

    await user.click(input); // ensure focus
    await user.paste(tooLong); // respects maxLength in JSDOM via user-event

    expect(input.value.length).toBe(300);

    await user.click(screen.getByTestId('send-button'));

    expect(emitFn).toHaveBeenCalledWith(
      'chatMessage',
      expect.objectContaining({ message: 'x'.repeat(300) }),
    );
    expect(alertSpy).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });
});
