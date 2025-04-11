// ChatMessageItem.tsx
import dayjs from 'dayjs';
import { FaUser } from 'react-icons/fa';
import { formatMessage } from '../utils/formatMessage';

export interface ChatMessage {
  sender: string;
  message: string;
  timestamp: number;
  type: 'user' | 'system';
}

interface ChatMessageItemProps {
  msg: ChatMessage;
  isCurrentUser?: boolean;
}

export function ChatMessageItem({
  msg,
  isCurrentUser = false,
}: ChatMessageItemProps) {
  const timeFormatted = dayjs(msg.timestamp).format('HH:mm');
  const formattedMessage = formatMessage(msg.message);

  if (msg.type === 'system') {
    return (
      <div
        className="my-4 rounded-lg border border-white/10 bg-indigo-800/30 px-4 py-3 text-center text-base italic text-indigo-200 shadow-sm backdrop-blur-sm"
        data-testid="system-message"
        role="status"
        aria-live="polite"
      >
        {formattedMessage}
      </div>
    );
  }

  return (
    <div
      className={`flex items-start gap-3 py-1 text-base ${isCurrentUser ? 'flex-row-reverse' : ''}`}
      data-testid="user-message"
      aria-label={`Message from ${msg.sender} at ${timeFormatted}`}
    >
      {/* Avatar */}
      <div
        className={`mt-1.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border ${
          isCurrentUser
            ? 'border-emerald-400 bg-emerald-500 shadow-lg shadow-emerald-500/20'
            : 'border-pink-400 bg-pink-500 shadow-lg shadow-pink-500/20'
        }`}
        aria-hidden="true"
      >
        <FaUser className="h-5 w-5 text-black" />
      </div>

      {/* Message Content */}
      <div
        className={`flex max-w-[80%] flex-1 flex-col ${isCurrentUser ? 'items-end' : 'items-start'}`}
      >
        <div
          className={`flex items-baseline gap-2 ${isCurrentUser ? 'justify-end' : ''}`}
          aria-hidden="true"
        >
          <span className="font-medium text-white">{msg.sender}</span>
          <span className="text-xs text-indigo-300">{timeFormatted}</span>
        </div>
        <div
          className={`mt-1 max-w-full whitespace-pre-wrap break-words rounded-xl px-4 py-3 text-left text-base leading-relaxed text-white shadow-lg ${
            isCurrentUser
              ? 'border border-emerald-400/20 bg-gradient-to-br from-emerald-600/90 to-emerald-500/90 shadow-emerald-500/20 backdrop-blur-sm'
              : 'border border-pink-400/20 bg-gradient-to-br from-pink-600/90 to-pink-500/90 shadow-pink-500/20 backdrop-blur-sm'
          }`}
          style={{
            overflowWrap: 'break-word',
            wordBreak: 'break-word',
          }}
        >
          <span
            className="inline-block w-full overflow-hidden"
            dangerouslySetInnerHTML={{ __html: formattedMessage }}
          />
        </div>
      </div>
    </div>
  );
}
