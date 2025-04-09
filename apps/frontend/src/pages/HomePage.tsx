import { useState, ChangeEvent, KeyboardEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  getOrCreatePlayerProfile,
  updatePlayerName
} from "../utils/playerProfile";
import { useRoomActions } from "../hooks/useRoomActions";

export default function HomePage() {
  const navigate = useNavigate();
  const { name: initialName } = getOrCreatePlayerProfile();
  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [roomName, setRoomName] = useState(`${initialName}'s room`);
  const [joinCode, setJoinCode] = useState("");

  const { createNewRoom, validateRoom } = useRoomActions();

  const handleSaveName = () => {
    const trimmed = name.trim();
    if (!trimmed.match(/^.{1,20}$/)) {
      alert("Name must be between 1 and 20 characters.");
      return;
    }
    updatePlayerName(trimmed);
    setRoomName(`${trimmed}'s room`);
    setEditing(false);
  };

  const handleCreateRoom = async (e: FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;
    const code = await createNewRoom();
    navigate(`/${code}`);
  };

  const handleJoinRoom = async (e: FormEvent) => {
    e.preventDefault();
    if (joinCode.length !== 4) return;
    const exists = await validateRoom(joinCode);
    if (!exists) {
      alert(`Room not found: ${joinCode}`);
      return;
    }
    navigate(`/${joinCode}`);
  };

  return (
    <div
      className="min-h-screen bg-[#12111A] text-white flex flex-col items-center px-4 py-8">
      <h1 className="text-4xl font-bold mb-8 tracking-tight text-white">Word
        Bomb</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
        {/* Name Panel */}
        <div className="bg-[#1E1B2E] rounded-2xl shadow-lg p-6 flex flex-col">
          <h2 className="text-lg font-semibold mb-4">Your Name</h2>
          {editing ? (
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && handleSaveName()}
                placeholder="Your name"
                maxLength={20}
                className="flex-1 px-4 py-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSaveName}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-4 py-2 rounded"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="flex justify-between items-center">
              <span className="text-lg font-medium">{name}</span>
              <button
                onClick={() => setEditing(true)}
                className="bg-gray-600 hover:bg-gray-500 px-3 py-1 rounded"
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Create Room Panel */}
        <div className="bg-[#1E1B2E] rounded-2xl shadow-lg p-6 flex flex-col">
          <h2 className="text-lg font-semibold mb-4">Create a Room</h2>
          <form onSubmit={handleCreateRoom} className="flex flex-col gap-3">
            <label className="text-sm font-medium text-gray-300"
                   htmlFor="roomName">Room name</label>
            <input
              id="roomName"
              value={roomName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setRoomName(e.target.value)}
              maxLength={30}
              placeholder="Enter room name"
              className="px-4 py-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!roomName.trim()}
            >
              Play
            </button>
          </form>
        </div>

        {/* Join Room Panel */}
        <div className="bg-[#1E1B2E] rounded-2xl shadow-lg p-6 flex flex-col">
          <h2 className="text-lg font-semibold mb-4">Join a Room</h2>
          <form onSubmit={handleJoinRoom} className="flex flex-col gap-3">
            <label className="text-sm font-medium text-gray-300"
                   htmlFor="joinCode">Code</label>
            <input
              id="joinCode"
              value={joinCode}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const filtered = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
                setJoinCode(filtered);
              }}
              placeholder="Enter 4-letter code"
              maxLength={4}
              pattern="[A-Z]{4}"
              className="px-4 py-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={joinCode.length !== 4}
            >
              Join
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}