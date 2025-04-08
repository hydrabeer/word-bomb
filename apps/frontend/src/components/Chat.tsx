import React, { useState, useCallback, useEffect } from "react";
import { socket } from "../socket";
import { useAutoScroll } from "../hooks/useAutoScroll";
import { ChatMessageItem, ChatMessage } from "./ChatMessageItem";

interface ChatProps {
  roomCode: string;
}

export default function Chat(props: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const roomCode = props.roomCode;
  const containerRef = useAutoScroll<HTMLDivElement>([messages]);

  useEffect(() => {
    const handleNewMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    };
    socket.on("chatMessage", handleNewMessage);
    return () => {
      socket.off("chatMessage", handleNewMessage);
    };
  }, []);

  const sendMessage = useCallback(() => {
    if (!newMessage.trim()) return;
    const name = localStorage.getItem("name");
    const userToken = localStorage.getItem("userToken");
    if (!roomCode || !name || !userToken) return;
    socket.emit("chatMessage", { roomCode, name, message: newMessage, userToken });
    setNewMessage("");
  }, [newMessage, roomCode]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Message List */}
      <div
        className="flex-1 overflow-y-auto p-2 space-y-3"
        ref={containerRef}
      >
        {messages.map((msg, idx) => (
          <ChatMessageItem key={idx} msg={msg}/>
        ))}
      </div>
      {/* Input Box */}
      <div className="p-2 border-t border-gray-700">
        <input
          type="text"
          value={newMessage}
          maxLength={300}
          placeholder="Type here to chat"
          className="w-full p-2 rounded bg-gray-800 border border-gray-600 focus:outline-none"
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  );
}
