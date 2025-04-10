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
}

export function ChatMessageItem({ msg }: ChatMessageItemProps) {
  const timeFormatted = dayjs(msg.timestamp).format('HH:mm');
  const formattedMessage = formatMessage(msg.message);

  if (msg.type === 'system') {
    return <div className="my-3 text-center text-sm italic text-gray-400">{formattedMessage}</div>;
  }

  return (
    <div className="flex items-start gap-3 text-sm text-gray-100">
      {/* Avatar */}
      <div className="mt-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-gray-700 shadow-sm">
        <FaUser className="h-4 w-4 text-gray-300" />
      </div>

      {/* Message Content */}
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-white">{msg.sender}</span>
          <span className="text-xs text-gray-400">{timeFormatted}</span>
        </div>
        <div
          className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-700/40 px-4 py-2.5 text-gray-100 shadow-sm shadow-black/10"
          style={{ overflowWrap: 'anywhere' }}
          dangerouslySetInnerHTML={{ __html: formattedMessage }}
        />
      </div>
    </div>
  );
}
