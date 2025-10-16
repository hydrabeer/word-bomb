import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  fireEvent,
  screen,
  act,
  within,
  waitFor,
} from '@testing-library/react';
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

  it('renders stats table when provided', () => {
    render(
      <Chat
        roomCode="ABCD"
        showStats
        stats={{
          username: 'Alice',
          totalWords: 5,
          averageWpm: 150.4,
          averageReactionSeconds: 1.234,
          longWords: 1,
          accuracyStreak: 3,
          hyphenatedWords: 2,
        }}
      />,
    );

    expect(screen.getByText('Usr')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('1.23 s')).toBeInTheDocument();
  });

  it('hides stats table when disabled', () => {
    render(
      <Chat
        roomCode="ABCD"
        showStats={false}
        stats={{
          username: 'Alice',
          totalWords: 5,
          averageWpm: 80,
          averageReactionSeconds: 1.5,
          longWords: 2,
          accuracyStreak: 1,
          hyphenatedWords: 0,
        }}
      />,
    );

    expect(screen.queryByText('Usr')).not.toBeInTheDocument();
  });

  it('formats empty stats gracefully', () => {
    render(
      <Chat
        roomCode="ABCD"
        showStats
        stats={{
          username: 'Alice',
          totalWords: 0,
          averageWpm: null,
          averageReactionSeconds: null,
          longWords: 0,
          accuracyStreak: 0,
          hyphenatedWords: 0,
        }}
      />,
    );

    const statsRow = screen.getByText('Alice').closest('tr');
    expect(statsRow).not.toBeNull();
    const row = statsRow!;
    expect(within(row).getAllByText('—')).toHaveLength(2);
    expect(within(row).getAllByText('0')).toHaveLength(4);
  });

  it('formats sub-100 wpm with one decimal and sanitizes invalid counts', () => {
    render(
      <Chat
        roomCode="ABCD"
        showStats
        stats={{
          username: 'Alice',
          totalWords: 4,
          averageWpm: 75.28,
          averageReactionSeconds: 0.5,
          longWords: Number.NaN,
          accuracyStreak: 2,
          hyphenatedWords: 1,
        }}
      />,
    );

    const row = screen.getByText('Alice').closest('tr');
    if (!row) {
      throw new Error('Stats row not found');
    }
    expect(within(row).getByText('75.3')).toBeInTheDocument();
    expect(within(row).getByText('0')).toBeInTheDocument();
    expect(within(row).queryByText('NaN')).toBeNull();
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

  it('focuses textarea when autoFocus is enabled', async () => {
    render(<Chat roomCode="ABCD" autoFocus />);
    const input = await screen.findByTestId<HTMLTextAreaElement>('chat-input');
    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
  });

  it('auto-resizes textarea and clamps height to 150px', async () => {
    render(<Chat roomCode="ABCD" />);
    const input = screen.getByTestId<HTMLTextAreaElement>('chat-input');

    Object.defineProperty(input, 'scrollHeight', {
      configurable: true,
      value: 200,
    });

    fireEvent.change(input, {
      target: { value: 'multi-line\nmessage with\nseveral lines' },
    });

    await waitFor(() => {
      expect(input.style.height).toBe('150px');
    });
  });

  it('prevents default browser form submission', () => {
    render(<Chat roomCode="ABCD" />);
    const input = screen.getByTestId<HTMLTextAreaElement>('chat-input');
    const form = input.closest('form');
    if (!form) {
      throw new Error('Chat form not found');
    }

    const event = new Event('submit', { bubbles: true, cancelable: true });
    let dispatchResult = true;
    act(() => {
      dispatchResult = form.dispatchEvent(event);
    });

    expect(dispatchResult).toBe(false);
    expect(event.defaultPrevented).toBe(true);
    expect(emitFn).not.toHaveBeenCalled();
  });
});
