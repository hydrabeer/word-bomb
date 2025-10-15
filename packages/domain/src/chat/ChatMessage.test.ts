import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  ChatMessageSchema,
  isChatMessage,
  parseChatMessage,
  toAuthoritativeChatMessage,
} from './ChatMessage';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ChatMessageSchema', () => {
  it('validates a correct chat message', () => {
    const validMessage = {
      roomCode: 'ABCD',
      sender: 'JohnDoe',
      message: 'Hello, world!',
      timestamp: 1672531200,
      type: 'user',
    };

    expect(() => ChatMessageSchema.parse(validMessage)).not.toThrow();
  });

  it('fails validation for an invalid roomCode', () => {
    const invalidMessage = {
      roomCode: 'ABCDE', // Invalid length
      sender: 'JohnDoe',
      message: 'Hello, world!',
      timestamp: 1672531200,
      type: 'user',
    };

    expect(() => ChatMessageSchema.parse(invalidMessage)).toThrow();
  });

  it('fails validation for a missing sender', () => {
    const invalidMessage = {
      roomCode: 'ABCD',
      message: 'Hello, world!',
      timestamp: 1672531200,
      type: 'user',
    };

    expect(() => ChatMessageSchema.parse(invalidMessage)).toThrow();
  });

  it('fails validation for an empty message', () => {
    const invalidMessage = {
      roomCode: 'ABCD',
      sender: 'JohnDoe',
      message: '', // Empty message
      timestamp: 1672531200,
      type: 'user',
    };

    expect(() => ChatMessageSchema.parse(invalidMessage)).toThrow();
  });

  it('validates a message without an optional type', () => {
    const validMessage = {
      roomCode: 'ABCD',
      sender: 'JohnDoe',
      message: 'Hello, world!',
      timestamp: 1672531200,
    };

    expect(() => ChatMessageSchema.parse(validMessage)).not.toThrow();
  });

  it('fails validation for a negative timestamp', () => {
    const invalidMessage = {
      roomCode: 'ABCD',
      sender: 'JohnDoe',
      message: 'Hello, world!',
      timestamp: -100, // Negative timestamp
      type: 'user',
    };

    expect(() => ChatMessageSchema.parse(invalidMessage)).toThrow();
  });

  it('fails validation for an invalid type', () => {
    const invalidMessage = {
      roomCode: 'ABCD',
      sender: 'JohnDoe',
      message: 'Hello, world!',
      timestamp: 1672531200,
      type: 'invalidType', // Invalid type
    };

    expect(() => ChatMessageSchema.parse(invalidMessage)).toThrow();
  });

  it('identifies valid messages with isChatMessage', () => {
    const validMessage = {
      roomCode: 'ABCD',
      sender: 'ValidUser',
      message: 'Hi!',
      timestamp: 1672531200,
      type: 'system',
    };

    expect(isChatMessage(validMessage)).toBe(true);
    expect(isChatMessage({})).toBe(false);
  });

  it('parses a message and applies defaults with parseChatMessage', () => {
    const parsed = parseChatMessage({
      roomCode: 'WXYZ',
      sender: 'Jane',
      message: 'Default type please.',
      timestamp: 42,
    });

    expect(parsed.type).toBe('user');
    expect(parsed).toMatchObject({
      roomCode: 'WXYZ',
      sender: 'Jane',
      message: 'Default type please.',
      timestamp: 42,
    });
  });

  it('converts inbound messages to authoritative payloads', () => {
    const now = 1234567890;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const payload = toAuthoritativeChatMessage({
      roomCode: 'ABCD',
      sender: 'Jane',
      message: 'Hello',
    });

    expect(payload).toEqual({
      roomCode: 'ABCD',
      sender: 'Jane',
      message: 'Hello',
      timestamp: now,
      type: 'user',
    });
  });
});
