import { useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getOrCreatePlayerProfile,
  updatePlayerName,
} from '../utils/playerProfile';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useRoomActions } from '../hooks/useRoomActions';

export default function HomePage() {
  const navigate = useNavigate();
  const { name: initialName } = getOrCreatePlayerProfile();
  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [roomName, setRoomName] = useState(`${initialName}'s room`);
  const [joinCode, setJoinCode] = useState('');

  useDocumentTitle('Word Bomb');

  const { createNewRoom, validateRoom } = useRoomActions();

  const handleSaveName = () => {
    const trimmed = name.trim();
    if (!/^.{1,20}$/.exec(trimmed)) {
      alert('Name must be between 1 and 20 characters.');
      return;
    }
    updatePlayerName(trimmed);
    setRoomName(`${trimmed}'s room`);
    setEditing(false);
  };

  const handleCreateRoom = async () => {
    if (!roomName.trim()) return;
    const code = await createNewRoom(roomName.trim());
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
    <div className="flex min-h-screen flex-col items-center bg-gradient-to-br from-indigo-950 to-purple-900 px-4 py-12 text-white">
      {/* Hero section */}
      <header className="mb-12 w-full max-w-6xl text-center">
        <h1 className="mb-4 bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-6xl font-bold tracking-tight text-transparent">
          Word Bomb
        </h1>
        <p className="mx-auto max-w-2xl text-lg leading-relaxed text-indigo-200">
          Challenge your friends with words and quick thinking in this
          fast-paced word game
        </p>
      </header>

      {/* Main content */}
      <main
        className="w-full max-w-5xl rounded-3xl border border-white/10 bg-indigo-900/30 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-sm"
        role="main"
      >
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
          {/* Left column - Profile & Create */}
          <div className="space-y-8">
            {/* Profile card */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur-sm">
              <h2 className="mb-5 flex items-center text-xl font-medium">
                <span className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500">
                  <span className="text-sm font-bold text-black">
                    {name.charAt(0).toUpperCase()}
                  </span>
                </span>
                Your Profile
              </h2>

              {/* Reserve vertical space to prevent layout shift when toggling edit mode */}
              <div className="min-h-[7rem] sm:min-h-[3.5rem]">
                {editing ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={name}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        setName(e.target.value);
                      }}
                      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) =>
                        e.key === 'Enter' && handleSaveName()
                      }
                      placeholder="Your name"
                      maxLength={20}
                      className="w-full rounded-lg border border-indigo-600/30 bg-indigo-900/30 px-4 py-3 text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      autoFocus
                      aria-label="Your display name"
                      aria-describedby="name-constraints"
                    />
                    <button
                      onClick={handleSaveName}
                      className="mt-2 whitespace-nowrap rounded-md bg-emerald-500 px-4 py-3 text-base font-medium text-black shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-900 active:scale-95 sm:mt-0"
                      aria-label="Save name"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-medium text-indigo-100">
                      {name}
                    </span>
                    <button
                      onClick={() => {
                        setEditing(true);
                      }}
                      className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium transition-all hover:bg-white/20 focus:ring-2 focus:ring-emerald-400 active:scale-95"
                      aria-label="Edit your name"
                    >
                      Edit Name
                    </button>
                  </div>
                )}
              </div>
              <p id="name-constraints" className="sr-only">
                Name must be between 1 and 20 characters.
              </p>
            </div>

            {/* Create Room card */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur-sm">
              <h2 className="mb-5 flex items-center text-xl font-medium">
                <span className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-purple-500">
                  <span className="text-sm font-bold text-black">+</span>
                </span>
                Create Room
              </h2>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleCreateRoom();
                }}
                className="space-y-5"
                aria-labelledby="create-room-heading"
              >
                <div>
                  <label
                    htmlFor="roomName"
                    className="mb-2 block text-sm font-medium text-indigo-200"
                  >
                    Room name
                  </label>
                  <input
                    id="roomName"
                    value={roomName}
                    onChange={(e) => {
                      setRoomName(e.target.value);
                    }}
                    maxLength={30}
                    placeholder="Enter room name"
                    className="w-full rounded-lg border border-indigo-600/30 bg-indigo-900/30 px-4 py-3 text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    aria-describedby="roomname-constraints"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-md bg-emerald-500 px-4 py-3 text-base font-medium text-black shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!roomName.trim()}
                  aria-label="Create a new game room"
                >
                  Create & Play
                </button>
                <p id="roomname-constraints" className="sr-only">
                  Room name up to 30 characters.
                </p>
              </form>
            </div>
          </div>

          {/* Right column - Join Room */}
          <div className="flex items-center justify-center">
            <div className="w-full rounded-xl border border-white/10 bg-gradient-to-br from-purple-800/50 to-indigo-800/50 p-8 shadow-lg">
              <h2 className="mb-6 flex items-center text-2xl font-medium">
                <span className="mr-3 flex h-9 w-9 items-center justify-center rounded-full bg-pink-500">
                  <span className="text-sm font-bold text-black">→</span>
                </span>
                Join Existing Room
              </h2>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleJoinRoom();
                }}
                className="space-y-5"
                aria-labelledby="join-room-heading"
              >
                <div>
                  <label
                    htmlFor="joinCode"
                    className="mb-2 block text-sm font-medium text-indigo-200"
                  >
                    Room code
                  </label>
                  <input
                    id="joinCode"
                    value={joinCode}
                    onChange={(e) => {
                      const filtered = e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z]/g, '');
                      setJoinCode(filtered);
                    }}
                    placeholder="Enter 4-letter code"
                    maxLength={4}
                    pattern="[A-Z]{4}"
                    className="text-md w-full rounded-lg border border-indigo-600/30 bg-indigo-900/30 px-4 py-5 text-center tracking-widest text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 sm:text-xl lg:text-2xl"
                    aria-describedby="joincode-constraints"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-md bg-pink-500 px-4 py-3 text-base font-medium text-white shadow-lg shadow-pink-500/20 transition-all hover:bg-pink-400 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={joinCode.length !== 4}
                  aria-label="Join existing room"
                >
                  Join Room
                </button>

                <p className="text-center text-sm leading-relaxed text-indigo-200">
                  Enter the 4-letter code provided by your friend
                </p>
                <p id="joincode-constraints" className="sr-only">
                  Enter exactly four uppercase letters.
                </p>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 text-center text-sm leading-relaxed text-indigo-300">
        Challenge friends with quick thinking and wordplay
      </footer>
    </div>
  );
}
