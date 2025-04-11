import { describe, it, expect } from 'vitest';
import { ChatMessageSchema } from './ChatMessage';

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
});
