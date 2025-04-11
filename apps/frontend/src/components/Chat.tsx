// Chat.tsx
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { socket } from '../socket';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { ChatMessageItem, ChatMessage } from './ChatMessageItem';
import { getOrCreatePlayerProfile } from '../utils/playerProfile';
import { ChatMessageSchema } from '@game/domain/chat/ChatMessage';
import { ChatMessagePayload } from '@game/domain/socket/types';
import { FaPaperPlane } from 'react-icons/fa';

interface ChatProps {
  roomCode: string;
  className?: string;
}

export default function Chat({ roomCode, className }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useAutoScroll<HTMLDivElement>([messages]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { name: currentUsername } = useMemo(() => getOrCreatePlayerProfile(), []);

  // Auto-resize function
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to correctly calculate the new height
    textarea.style.height = 'auto';

    // Set the new height based on scrollHeight (with a max height if desired)
    const newHeight = Math.min(textarea.scrollHeight, 150); // Max height of 150px
    textarea.style.height = `${newHeight}px`;
  }, []);

  // Adjust height whenever message content changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [newMessage, adjustTextareaHeight]);

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
    if (!trimmed || isLoading) return;

    setIsLoading(true);

    const messagePayload = {
      roomCode,
      sender: currentUsername,
      message: trimmed,
      timestamp: Date.now(),
      type: 'user' as const,
    };

    const result = ChatMessageSchema.safeParse(messagePayload);

    if (!result.success) {
      console.warn('Invalid chat message input:', result.error);
      alert('Invalid message.');
      setIsLoading(false);
      return;
    }

    socket.emit('chatMessage', result.data);
    setNewMessage('');
    setIsLoading(false);
  }, [newMessage, roomCode, currentUsername, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-indigo-950 to-purple-900 shadow-lg ${className || ''}`}
      aria-label="Chat interface"
    >
      <div className="border-b border-white/10 bg-gradient-to-r from-indigo-800/70 to-purple-800/70 p-3 text-white backdrop-blur-sm">
        <h3 className="flex items-center text-base font-medium">
          <span className="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500">
            <span className="text-xs font-bold text-black">C</span>
          </span>
          Chat - Room {roomCode}
        </h3>
      </div>

      {/* Message List */}
      <div
        ref={containerRef}
        className="scrollbar-thin scrollbar-track-indigo-900/30 scrollbar-thumb-indigo-700/50 flex-1 space-y-4 overflow-y-auto px-4 py-4"
        data-testid="chat-messages"
        aria-live="polite"
        aria-relevant="additions"
        role="log"
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-indigo-300">
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center shadow-sm backdrop-blur-sm">
              <p className="text-base leading-relaxed">No messages yet. Say hello!</p>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <ChatMessageItem
              key={`${msg.timestamp}-${idx}`}
              msg={msg}
              isCurrentUser={msg.sender === currentUsername}
            />
          ))
        )}
      </div>

      {/* Input Box */}
      <div className="border-t border-white/10 bg-white/5 px-4 py-3 shadow-inner backdrop-blur-sm">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
        >
          <div className="relative block flex-1">
            <textarea
              ref={textareaRef}
              value={newMessage}
              maxLength={300}
              placeholder="Type your message..."
              rows={1}
              className="scrollbar-none max-h-[150px] min-h-[48px] w-full resize-none rounded-lg border border-indigo-600/30 bg-indigo-900/30 px-4 py-3 pr-16 text-base text-white placeholder-indigo-300 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400"
              onChange={(e) => {
                setNewMessage(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              data-testid="chat-input"
              aria-label="Type your message"
              style={{
                overflowY: 'hidden', // Hide vertical scrollbar
              }}
            />
            <span
              className="absolute bottom-2 right-3 rounded bg-indigo-900/80 px-1 text-xs text-indigo-300"
              aria-live="polite"
              aria-atomic="true"
            >
              {newMessage.length}/300
            </span>
          </div>
          <button
            type="submit"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={!newMessage.trim() || isLoading}
            aria-label="Send message"
            data-testid="send-button"
          >
            <FaPaperPlane className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
