import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FaChevronRight, FaChevronLeft } from "react-icons/fa";
import { socket } from "../socket";
import Chat from "../components/Chat";

type Player = {
  id: string;
  name: string;
  isAlive: boolean;
};

type RoomData = {
  code: string;
  players: Player[];
  currentTurnIndex: number;
  usedWords: Set<string>;
  fragment: string;
  isPlaying: boolean;
};

export default function Room() {
  const { roomCode } = useParams();
  const [players, setPlayers] = useState<Player[]>([]);
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
      setPlayers(room.players);
    });

    return () => {
      socket.off("roomUpdate");
    };
  }, [roomCode]);

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-gray-700 text-white">
      {/* Main content area: left sidebar + center */}
      <div className="flex h-full">
        {/* Left Sidebar */}
        <div className="w-64 bg-gray-800 p-4 overflow-y-auto">
          <h1 className="text-2xl font-bold mb-4">Room: {roomCode}</h1>
          <h2 className="text-xl mb-2">Players</h2>
          <ul className="list-disc list-inside">
            {players.map((player) => (
              <li key={player.id}>
                {player.name} {player.isAlive ? "" : "(eliminated)"}
              </li>
            ))}
          </ul>
        </div>

        {/* Center Area: Game Placeholder */}
        <div className="flex-1 p-4">
          <h2 className="text-3xl font-bold mb-4">Game Area</h2>
          {/* Put your actual gameplay UI here */}
        </div>
      </div>

      {/* CHAT PANEL (slides in/out) */}
      <div
        className={`absolute top-0 right-0 h-full w-96 bg-gray-900 transform transition-transform duration-300 ${
          isChatOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <Chat/>
      </div>

      {/* TOGGLE BUTTON (top-right corner) */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="absolute top-2 right-2 z-50 bg-gray-600 hover:bg-gray-500 text-white p-2 rounded shadow"
        aria-label={isChatOpen ? "Close chat" : "Open chat"}
      >
        {isChatOpen ? <FaChevronRight/> : <FaChevronLeft/>}
      </button>
    </div>
  );
}
