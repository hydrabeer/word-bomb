import { useState, ChangeEvent, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOrCreatePlayerProfile, updatePlayerName } from '../utils/playerProfile';
import { useRoomActions } from '../hooks/useRoomActions';

export default function HomePage() {
  const navigate = useNavigate();
  const { name: initialName } = getOrCreatePlayerProfile();
  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [roomName, setRoomName] = useState(`${initialName}'s room`);
  const [joinCode, setJoinCode] = useState('');

  const { createNewRoom, validateRoom } = useRoomActions();

  const handleSaveName = () => {
    const trimmed = name.trim();
    if (!trimmed.match(/^.{1,20}$/)) {
      alert('Name must be between 1 and 20 characters.');
      return;
    }
    updatePlayerName(trimmed);
    setRoomName(`${trimmed}'s room`);
    setEditing(false);
  };

  const handleCreateRoom = async () => {
    if (!roomName.trim()) return;
    const code = await createNewRoom();
    void navigate(`/${code}`);
  };

  const handleJoinRoom = async () => {
    if (joinCode.length !== 4) return;
    const exists = await validateRoom(joinCode);
    if (!exists) {
      alert(`Room not found: ${joinCode}`);
      return;
    }
    void navigate(`/${joinCode}`);
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-900 px-4 py-8 text-white">
      <h1 className="mb-8 text-4xl font-bold tracking-tight text-white">Word Bomb</h1>

      <div className="grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
        {/* Name Panel */}
        <div className="flex flex-col rounded-2xl bg-gray-800 p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold">Your Name</h2>
          {editing ? (
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) =>
                  e.key === 'Enter' && handleSaveName()
                }
                placeholder="Your name"
                maxLength={20}
                className="flex-1 rounded border border-gray-700 bg-gray-900 px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                onClick={handleSaveName}
                className="rounded bg-emerald-500 px-4 py-2 font-semibold text-black hover:bg-emerald-400"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-lg font-medium">{name}</span>
              <button
                onClick={() => setEditing(true)}
                className="rounded bg-gray-700 px-3 py-1 text-sm hover:bg-gray-600"
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Create Room Panel */}
        <div className="flex flex-col rounded-2xl bg-gray-800 p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold">Create a Room</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreateRoom(); // ✅ void the Promise to silence ESLint
            }}
            className="flex flex-col gap-3"
          >
            <label htmlFor="roomName" className="text-sm font-medium text-gray-300">
              Room name
            </label>
            <input
              id="roomName"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              maxLength={30}
              placeholder="Enter room name"
              className="rounded border border-gray-700 bg-gray-900 px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              type="submit"
              className="rounded bg-emerald-500 py-2 font-bold text-black transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!roomName.trim()}
            >
              Play
            </button>
          </form>
        </div>

        {/* Join Room Panel */}
        <div className="flex flex-col rounded-2xl bg-gray-800 p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold">Join a Room</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleJoinRoom(); // ✅
            }}
            className="flex flex-col gap-3"
          >
            <label htmlFor="joinCode" className="text-sm font-medium text-gray-300">
              Code
            </label>
            <input
              id="joinCode"
              value={joinCode}
              onChange={(e) => {
                const filtered = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
                setJoinCode(filtered);
              }}
              placeholder="Enter 4-letter code"
              maxLength={4}
              pattern="[A-Z]{4}"
              className="rounded border border-gray-700 bg-gray-900 px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              type="submit"
              className="rounded bg-emerald-500 py-2 font-bold text-black transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
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
