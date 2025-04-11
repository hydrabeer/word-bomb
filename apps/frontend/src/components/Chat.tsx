import React, { useState, useCallback, useEffect } from 'react';
import { socket } from '../socket';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { ChatMessageItem, ChatMessage } from './ChatMessageItem';
import { getOrCreatePlayerProfile } from '../utils/playerProfile.ts';
import { ChatMessageSchema } from '@game/domain/chat/ChatMessage';
import { ChatMessagePayload } from '@game/domain/socket/types.ts';

interface ChatProps {
  roomCode: string;
}

export default function Chat({ roomCode }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const containerRef = useAutoScroll<HTMLDivElement>([messages]);

  useEffect(() => {
    const handleNewMessage = (data: ChatMessagePayload) => {
      const normalized: ChatMessage = {
        ...data,
        type: data.type ?? 'user',
      };
      setMessages((prev) => [...prev, normalized]);
    };

    socket.on('chatMessage', handleNewMessage);
    return () => {
      socket.off('chatMessage', handleNewMessage);
    };
  }, []);

  const sendMessage = useCallback(() => {
    const trimmed = newMessage.trim();
    if (!trimmed) return;

    const { name } = getOrCreatePlayerProfile();

    const messagePayload = {
      roomCode,
      sender: name,
      message: trimmed,
      timestamp: Date.now(),
      type: 'user' as const,
    };

    const result = ChatMessageSchema.safeParse(messagePayload);

    if (!result.success) {
      console.warn('Invalid chat message input:', result.error);
      alert('Invalid message.');
      return;
    }

    socket.emit('chatMessage', result.data);
    setNewMessage('');
  }, [newMessage, roomCode]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-t-xl bg-gray-800 md:rounded-none">
      {/* Message List */}
      <div ref={containerRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.map((msg, idx) => (
          <ChatMessageItem key={idx} msg={msg} />
        ))}
      </div>

      {/* Input Box */}
      <div className="border-t border-gray-700 bg-gray-900 px-4 py-3 shadow-inner">
        <label className="relative block max-w-full">
          <input
            type="text"
            value={newMessage}
            maxLength={300}
            placeholder="Type your message..."
            className="peer w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 pt-4 text-sm text-white placeholder-transparent transition focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className="pointer-events-none absolute left-4 top-2.5 text-sm text-gray-400 opacity-0 transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400 peer-placeholder-shown:opacity-100 peer-focus:top-0.5 peer-focus:text-xs peer-focus:text-indigo-400 peer-focus:opacity-100">
            Type your message...
          </span>
        </label>
      </div>
    </div>
  );
}
