// Chat.tsx
import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { socket } from '../socket';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { getOrCreatePlayerProfile } from '../utils/playerProfile';
import { ChatMessageItem } from './ChatMessageItem';
import type {
  ChatMessagePayload,
  ChatMessageDraft,
} from '@word-bomb/types/socket';
import { FaPaperPlane } from 'react-icons/fa';
import type { PlayerStatsSnapshot } from '../hooks/usePlayerStats';

interface ChatProps {
  roomCode: string;
  roomName?: string;
  className?: string;
  headingId?: string; // used to link region to heading for a11y
  autoFocus?: boolean; // when true, focus textarea
  regionRole?: 'complementary' | 'region'; // default complementary
  stats?: PlayerStatsSnapshot | null;
  showStats?: boolean;
}

export default function Chat({
  roomCode,
  roomName,
  className,
  headingId,
  autoFocus = false,
  regionRole = 'complementary',
  stats,
  showStats = false,
}: ChatProps) {
  const [messages, setMessages] = useState<ChatMessagePayload[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useAutoScroll<HTMLDivElement>([messages]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { name: currentUsername } = useMemo(
    () => getOrCreatePlayerProfile(),
    [],
  );

  const resolvedStats = useMemo(() => {
    if (!showStats || !stats) return null;
    return {
      username: stats.username || currentUsername,
      totalWords: stats.totalWords,
      averageWpm: stats.averageWpm,
      averageReactionSeconds: stats.averageReactionSeconds,
      longWords: stats.longWords,
      accuracyStreak: stats.accuracyStreak,
      hyphenatedWords: stats.hyphenatedWords,
    };
  }, [showStats, stats, currentUsername]);

  const formatCount = useCallback((value: number | undefined | null) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '0';
    return value.toString();
  }, []);

  const formatWpm = useCallback((value: number | null) => {
    if (value == null || !Number.isFinite(value)) return '—';
    if (value >= 100) return Math.round(value).toString();
    return value.toFixed(1);
  }, []);

  const formatReaction = useCallback((value: number | null) => {
    if (value == null || !Number.isFinite(value)) return '—';
    return `${value.toFixed(2)} s`;
  }, []);

  // Auto-resize function
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to correctly calculate the new height
    textarea.style.height = 'auto';

    // Set the new height based on scrollHeight (with a max height if desired)
    const newHeight = Math.min(textarea.scrollHeight, 150); // Max height of 150px
    textarea.style.height = `${String(newHeight)}px`;
  }, []);

  // Adjust height whenever message content changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [newMessage, adjustTextareaHeight]);

  // Focus textarea when autoFocus toggles on
  useEffect(() => {
    if (autoFocus) {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        // place caret at end
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    }
  }, [autoFocus]);

  // Clear messages when room changes to avoid showing previous room history
  useEffect(() => {
    setMessages([]);
  }, [roomCode]);

  useEffect(() => {
    const handleNewMessage = (data: ChatMessagePayload) => {
      // Only accept messages for the active room
      if (data.roomCode !== roomCode) return;
      setMessages((prev) => [...prev, data]);
    };

    socket.on('chatMessage', handleNewMessage);
    return () => {
      socket.off('chatMessage', handleNewMessage);
    };
  }, [roomCode]);

  const sendMessage = useCallback(() => {
    const trimmed = newMessage.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);

    const draft: ChatMessageDraft = {
      roomCode,
      sender: currentUsername,
      message: trimmed,
    };
    socket.emit('chatMessage', draft);
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
      className={`flex h-full flex-col overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-indigo-950 to-purple-900 shadow-lg ${className ?? ''}`}
      role={regionRole}
      aria-label={headingId ? undefined : 'Chat interface'}
      aria-labelledby={headingId}
    >
      <div className="border-b border-white/10 bg-gradient-to-r from-indigo-800/70 to-purple-800/70 p-3 text-white backdrop-blur-sm">
        <h3 id={headingId} className="flex items-center text-base font-medium">
          <span className="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500">
            <span className="text-xs font-bold text-black">C</span>
          </span>
          {roomName ? <>{roomName} — Chat</> : <>Chat — Room {roomCode}</>}
        </h3>
      </div>

      {resolvedStats && (
        <div className="hidden border-b border-white/10 bg-white/5 px-4 py-3 text-sm text-indigo-100 backdrop-blur-sm md:block">
          <table className="w-full table-fixed">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.18em] text-indigo-300">
                <th className="py-1 pr-2 text-left font-semibold">
                  <abbr
                    title="Username"
                    className="cursor-help text-indigo-200 no-underline"
                  >
                    User
                  </abbr>
                </th>
                <th className="py-1 pr-2 text-right font-semibold">
                  <abbr
                    title="Total words submitted"
                    className="cursor-help text-indigo-200 no-underline"
                  >
                    Words
                  </abbr>
                </th>
                <th className="py-1 pr-2 text-right font-semibold">
                  <abbr
                    title="Average typing speed (words per minute)"
                    className="cursor-help text-indigo-200 no-underline"
                  >
                    WPM
                  </abbr>
                </th>
                <th className="py-1 pr-2 text-right font-semibold">
                  <abbr
                    title="Average reaction time to submit"
                    className="cursor-help text-indigo-200 no-underline"
                  >
                    React
                  </abbr>
                </th>
                <th className="py-1 pr-2 text-right font-semibold">
                  <abbr
                    title="Words with 20 or more characters"
                    className="cursor-help text-indigo-200 no-underline"
                  >
                    Long
                  </abbr>
                </th>
                <th className="py-1 pr-2 text-right font-semibold">
                  <abbr
                    title="Current accuracy streak"
                    className="cursor-help text-indigo-200 no-underline"
                  >
                    Streak
                  </abbr>
                </th>
                <th className="py-1 text-right font-semibold">
                  <abbr
                    title="Hyphenated words"
                    className="cursor-help text-indigo-200 no-underline"
                  >
                    Hyphen
                  </abbr>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-[13px] text-white">
                <td className="py-1 pr-2 font-medium text-white">
                  {resolvedStats.username}
                </td>
                <td className="py-1 pr-2 text-right font-semibold text-indigo-50">
                  {formatCount(resolvedStats.totalWords)}
                </td>
                <td className="py-1 pr-2 text-right font-semibold text-indigo-50">
                  {formatWpm(resolvedStats.averageWpm)}
                </td>
                <td className="py-1 pr-2 text-right font-semibold text-indigo-50">
                  {formatReaction(resolvedStats.averageReactionSeconds)}
                </td>
                <td className="py-1 pr-2 text-right font-semibold text-indigo-50">
                  {formatCount(resolvedStats.longWords)}
                </td>
                <td className="py-1 pr-2 text-right font-semibold text-indigo-50">
                  {formatCount(resolvedStats.accuracyStreak)}
                </td>
                <td className="py-1 text-right font-semibold text-indigo-50">
                  {formatCount(resolvedStats.hyphenatedWords)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

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
              <p className="text-base leading-relaxed">
                No messages yet. Say hello!
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <ChatMessageItem
              key={`${String(msg.timestamp)}-${String(idx)}`}
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
            // Prevent native submit; key handler or button click triggers send
            e.preventDefault();
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
            type="button"
            onClick={sendMessage}
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
