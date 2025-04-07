import dayjs from "dayjs";
import { FaUser } from "react-icons/fa";
import { formatMessage } from "../utils/formatMessage";

export type ChatMessage = {
  sender: string;
  message: string;
  timestamp: number;
};

type ChatMessageItemProps = {
  msg: ChatMessage;
};

export function ChatMessageItem({ msg }: ChatMessageItemProps) {
  const timeFormatted = dayjs(msg.timestamp).format("HH:mm");
  const formattedMessage = formatMessage(msg.message);

  return (
    <div className="flex items-start space-x-2">
      <FaUser className="w-4 h-4 text-gray-400 flex-shrink-0"/>
      <div>
        <div className="text-sm mb-1">
          <span className="font-bold">{msg.sender}</span>
          <span className="text-xs text-gray-400 ml-2">{timeFormatted}</span>
        </div>
        <div
          className="text-sm whitespace-pre-wrap"
          style={{ overflowWrap: 'anywhere' }}
          // NOTE: For production, consider sanitizing this HTML with a library like DOMPurify.
          dangerouslySetInnerHTML={{ __html: formattedMessage }}
        />
      </div>
    </div>
  );
}
