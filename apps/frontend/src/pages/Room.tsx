import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FaComments } from "react-icons/fa";
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
  const [isChatVisible, setIsChatVisible] = useState(true);

  useEffect(() => {
    if (!roomCode) return;
    // Save roomCode to localStorage for Chat component use
    localStorage.setItem("roomCode", roomCode);
    document.title = `[${roomCode}] Word Bomb`;

    // Listen for room updates from the server
    socket.on("roomUpdate", (room: RoomData) => {
      console.log("Room update:", room);
      setPlayers(room.players);
    });

    // Clean up the listener when component unmounts
    return () => {
      socket.off("roomUpdate");
    };
  }, [roomCode]);

  return (
    <div className="flex h-screen w-screen relative">
      {/* Left Sidebar: Players List */}
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
      <div className="flex-1 bg-gray-700 p-4">
        <h2 className="text-3xl font-bold mb-4">Game Area</h2>
        {/* This is where the game UI would go */}
      </div>

      {/* Right Sidebar: Chat Panel */}
      {isChatVisible && (
        <div className="w-72 bg-gray-800 p-4 flex flex-col">
          <h2 className="text-xl font-bold mb-2">Chat</h2>
          <Chat/>
        </div>
      )}

      {/* Global Chat Toggle Button */}
      <button
        onClick={() => setIsChatVisible(!isChatVisible)}
        className="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-full shadow-lg"
      >
        <FaComments className="w-6 h-6"/>
      </button>
    </div>
  );
}
