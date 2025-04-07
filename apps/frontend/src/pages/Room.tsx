import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaChevronRight,
  FaChevronLeft,
  FaChevronUp,
  FaChevronDown,
} from "react-icons/fa";
import { socket } from "../socket";
import GameArea from "../components/GameArea";
import Chat from "../components/Chat";

type Player = {
  id: string;
  name: string;
  isAlive: boolean;
};

type RoomData = {
  code: string;
  roomName?: string;
  players: Player[];
  currentTurnIndex: number;
  usedWords: Set<string>;
  fragment: string;
  isPlaying: boolean;
};

export default function Room() {
  const navigate = useNavigate();
  const { roomCode } = useParams();
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(true);

  useEffect(() => {
    if (!roomCode) return;

    localStorage.setItem("roomCode", roomCode);
    document.title = `[${roomCode}] Word Bomb`;

    // If a name is stored, re-emit joinRoom on refresh
    const storedName = localStorage.getItem("name");
    const userToken = localStorage.getItem("userToken")
    if (storedName) {
      socket.connect(); // reconnect if necessary
      socket.emit("joinRoom", { name: storedName, roomCode, userToken });
    }

    socket.on("roomUpdate", (room: RoomData) => {
      setRoomData(room);
      document.title = `[${roomCode}] ${room.roomName} | Word Bomb`;
    });

    return () => {
      socket.off("roomUpdate");
    };
  }, [roomCode]);

  useEffect(() => {
    const handleDisconnect = () => {
      navigate("/disconnected");
    };

    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("disconnect", handleDisconnect);
    };
  }, [navigate]);

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-gray-900 text-white">
      {/* Main content area: left sidebar + center */}
      <div className="flex h-full">
        {/* Left Sidebar */}
        <div className="w-screen md:w-96 bg-gray-800 p-4 overflow-y-auto break-words whitespace-pre-wrap">
          <h1
            className="text-2xl font-bold mb-4">Room: {roomData?.roomName || roomCode}</h1>
          <h2 className="text-xl mb-2">Players</h2>
          <ul className="list-disc list-inside">
            {roomData?.players.map((player) => (
              <li key={player.id}>
                {player.name} {player.isAlive ? "" : "(eliminated)"}
              </li>
            ))}
          </ul>
        </div>

        {/* Main game area */}
        <div className="flex-1 p-4 hidden">
          <GameArea/>
        </div>
      </div>

      {/* CHAT PANEL (slides in/out) */}
      {/*
        For mobile (default):
          Positioned at the bottom, full width, 1/3 of the screen height.
        For md+ screens:
          Positioned at the right, fixed width and full height.
      */}
      <div
        className={`absolute bg-gray-900 transform transition-transform duration-300 
          bottom-0 left-0 w-full h-1/3 md:top-0 md:right-0 md:bottom-auto md:left-auto md:w-96 md:h-full md:translate-y-0
          ${isChatOpen ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-x-full"}`}
      >
        <Chat/>
      </div>

      {/* TOGGLE BUTTON */}
      {/*
          On mobile: placed near bottom center with up/down icons.
          On desktop: placed in top-right corner with left/right icons.
      */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className={`
          absolute z-50 bg-gray-600 hover:bg-gray-500 text-white p-2 rounded shadow
          md:top-2 md:right-2 md:bottom-auto md:left-auto md:transform-none
          ${
          // Mobile: if chat is open, position the button above the chat drawer (chat height = 33% of screen)
          // Otherwise, position it at the bottom center.
          isChatOpen
            ? "bottom-[calc(33%+0.5rem)] left-1/2 transform -translate-x-1/2"
            : "bottom-2 left-1/2 transform -translate-x-1/2"
        }
  `}

        aria-label={isChatOpen ? "Close chat" : "Open chat"}
      >
        {/* Mobile toggle icons */}
        <span className="block md:hidden">
          {isChatOpen ? <FaChevronDown/> : <FaChevronUp/>}
        </span>
        {/* Desktop toggle icons */}
        <span className="hidden md:block">
          {isChatOpen ? <FaChevronRight/> : <FaChevronLeft/>}
        </span>
      </button>
    </div>
  );
}
