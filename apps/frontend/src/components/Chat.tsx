import { useEffect, useState } from "react";
import { socket } from "../socket";

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
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {messages.map((msg, idx) => (
          <div key={idx} className="text-sm">
            <span className="font-bold">{msg.sender}: </span>
            <span>{msg.message}</span>
          </div>
        ))}
      </div>
      <div className="p-2 border-t border-gray-700">
        <input
          type="text"
          value={newMessage}
          placeholder="Type a message..."
          className="w-full p-2 rounded bg-gray-800 border border-gray-600 focus:outline-none"
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
        />
      </div>
    </div>
  );
}
