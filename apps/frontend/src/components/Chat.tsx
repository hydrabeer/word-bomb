import { useEffect, useState } from "react";
import { socket } from "../socket";
import dayjs from "dayjs";
import linkifyHtml from "linkify-html";
import { FaUser } from "react-icons/fa";

type ChatMessage = {
  sender: string;
  message: string;
  timestamp: number;
};

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    socket.on("chatMessage", (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.off("chatMessage");
    };
  }, []);

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    // Retrieve the roomCode and name from localStorage or other source
    const roomCode = localStorage.getItem("roomCode");
    const name = localStorage.getItem("name");
    if (!roomCode || !name) return;

    socket.emit("chatMessage", { roomCode, name, message: newMessage });
    setNewMessage("");
  };


  return (
    <div className="flex flex-col h-full">
      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {messages.map((msg, idx) => {
          const time = dayjs(msg.timestamp).format("HH:mm");
          const linkified = linkifyHtml(msg.message, {
            defaultProtocol: "https",
            target: "_blank",
            rel: "noopener noreferrer",
          });

          return (
            <div key={idx} className="flex items-start space-x-2">
              {/* Default avatar */}
              <FaUser className="w-4 h-4 text-gray-400 flex-shrink-0"/>

              <div>
                {/* Sender + Timestamp */}
                <div className="text-sm mb-1">
                  <span className="font-bold">{msg.sender}</span>
                  <span className="text-xs text-gray-400 ml-2">{time}</span>
                </div>
                {/* Message text with clickable links */}
                <div
                  className="text-sm"
                  dangerouslySetInnerHTML={{ __html: linkified }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Box */}
      <div className="p-2 border-t border-gray-700">
        <input
          type="text"
          value={newMessage}
          placeholder="Type here to chat"
          className="w-full p-2 rounded bg-gray-800 border border-gray-600 focus:outline-none"
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              sendMessage();
            }
          }}
        />
      </div>
    </div>
  );
}
