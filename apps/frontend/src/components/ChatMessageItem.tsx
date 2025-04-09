import dayjs from 'dayjs';
import { FaUser } from 'react-icons/fa';
import { formatMessage } from '../utils/formatMessage';

export interface ChatMessage {
  sender: string;
  message: string;
  timestamp: number;
}

interface ChatMessageItemProps {
  msg: ChatMessage;
}

export function ChatMessageItem({ msg }: ChatMessageItemProps) {
  const timeFormatted = dayjs(msg.timestamp).format('HH:mm');
  const formattedMessage = formatMessage(msg.message);

  return (
    <div className="flex items-start gap-3">
      {/* Avatar */}
      <div className="mt-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-gray-700 text-xs text-white">
        <FaUser className="h-4 w-4 text-gray-300" />
      </div>

      {/* Message Content */}
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-white">{msg.sender}</span>
          <span className="text-xs font-normal text-white/50">{timeFormatted}</span>
        </div>
        <div
          className="mt-1 whitespace-pre-wrap rounded-lg bg-[#2C2A3A] px-4 py-2.5 text-sm text-white/90 shadow-md shadow-black/5"
          style={{ overflowWrap: 'anywhere' }}
          dangerouslySetInnerHTML={{ __html: formattedMessage }}
        />
      </div>
    </div>
  );
}
