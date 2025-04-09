import { useState, ChangeEvent, KeyboardEvent, FormEvent } from 'react';
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
    <div className="flex min-h-screen flex-col items-center bg-[#12111A] px-4 py-8 text-white">
      <h1 className="mb-8 text-4xl font-bold tracking-tight text-white">Word Bomb</h1>

      <div className="grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
        {/* Name Panel */}
        <div className="flex flex-col rounded-2xl bg-[#1E1B2E] p-6 shadow-lg">
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
                className="flex-1 rounded border border-gray-600 bg-gray-700 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="rounded bg-gray-600 px-3 py-1 hover:bg-gray-500"
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Create Room Panel */}
        <div className="flex flex-col rounded-2xl bg-[#1E1B2E] p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-semibold">Create a Room</h2>
          <form onSubmit={handleCreateRoom} className="flex flex-col gap-3">
            <label className="text-sm font-medium text-gray-300" htmlFor="roomName">
              Room name
            </label>
            <input
              id="roomName"
              value={roomName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setRoomName(e.target.value)}
              maxLength={30}
              placeholder="Enter room name"
              className="rounded border border-gray-600 bg-gray-700 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="rounded bg-emerald-500 py-2 font-bold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!roomName.trim()}
            >
              Play
            </button>
          </form>
        </div>

        {/* Join Room Panel */}
        <div className="flex flex-col rounded-2xl bg-[#1E1B2E] p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-semibold">Join a Room</h2>
          <form onSubmit={handleJoinRoom} className="flex flex-col gap-3">
            <label className="text-sm font-medium text-gray-300" htmlFor="joinCode">
              Code
            </label>
            <input
              id="joinCode"
              value={joinCode}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const filtered = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
                setJoinCode(filtered);
              }}
              placeholder="Enter 4-letter code"
              maxLength={4}
              pattern="[A-Z]{4}"
              className="rounded border border-gray-600 bg-gray-700 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="rounded bg-emerald-500 py-2 font-bold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
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
