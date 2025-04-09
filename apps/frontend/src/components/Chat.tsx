import React, { useState, useCallback, useEffect } from 'react';
import { socket } from '../socket';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { ChatMessageItem, ChatMessage } from './ChatMessageItem';
import { getOrCreatePlayerProfile } from '../utils/playerProfile.ts';
import { ChatMessageSchema } from '@game/domain/chat/ChatMessage';

interface ChatProps {
  roomCode: string;
}

export default function Chat({ roomCode }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const containerRef = useAutoScroll<HTMLDivElement>([messages]);

  useEffect(() => {
    const handleNewMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
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
    <div className="flex h-full flex-col overflow-hidden rounded-xl bg-[#1A1827]">
      {/* Message List */}
      <div ref={containerRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.map((msg, idx) => (
          <ChatMessageItem key={idx} msg={msg} />
        ))}
      </div>

      {/* Input Box */}
      <div className="border-t border-purple-800/40 bg-[#1E1B2E] px-4 py-3 shadow-inner shadow-purple-900/10">
        <label className="relative block">
          <input
            type="text"
            value={newMessage}
            maxLength={300}
            placeholder="Type your message..."
            className={`peer w-full rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 pt-4 text-sm text-white placeholder-transparent transition-all duration-200 ease-in-out focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 peer-placeholder-shown:pt-2`}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span
            className={`pointer-events-none absolute left-4 top-2.5 text-sm text-gray-400 transition-all duration-200 ease-in-out peer-placeholder-shown:top-3 peer-focus:top-0.5 peer-focus:text-xs peer-focus:text-blue-400`}
          >
            Type your message...
          </span>
        </label>
      </div>
    </div>
  );
}
