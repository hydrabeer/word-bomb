import dayjs from "dayjs";
import { FaUser } from "react-icons/fa";
import { formatMessage } from "../utils/formatMessage";

export interface ChatMessage {
  sender: string;
  message: string;
  timestamp: number;
}

interface ChatMessageItemProps {
  msg: ChatMessage;
}

export function ChatMessageItem({ msg }: ChatMessageItemProps) {
  const timeFormatted = dayjs(msg.timestamp).format("HH:mm");
  const formattedMessage = formatMessage(msg.message);

  return (
    <div className="flex items-start gap-3">
      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-white text-xs mt-1.5">
        <FaUser className="w-4 h-4 text-gray-300"/>
      </div>

      {/* Message Content */}
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-white text-sm">{msg.sender}</span>
          <span
            className="text-xs text-white/50 font-normal">{timeFormatted}
          </span>
        </div>
        <div
          className="mt-1 px-4 py-2.5 rounded-lg bg-[#2C2A3A] text-sm text-white/90 shadow-md shadow-black/5 whitespace-pre-wrap"
          style={{ overflowWrap: "anywhere" }}
          dangerouslySetInnerHTML={{ __html: formattedMessage }}
        />

      </div>
    </div>
  );
}
