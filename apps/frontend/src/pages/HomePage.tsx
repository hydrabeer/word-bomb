import {
  useEffect,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { FaGlobe, FaLock } from 'react-icons/fa';
import {
  getOrCreatePlayerProfile,
  updatePlayerName,
} from '../utils/playerProfile';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useRoomActions } from '../hooks/useRoomActions';
import {
  listPublicRooms,
  type RoomSummary,
  type RoomVisibility,
} from '../api/rooms';

export default function HomePage() {
  const navigate = useNavigate();
  const { name: initialName } = getOrCreatePlayerProfile();
  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [roomName, setRoomName] = useState(`${initialName}'s room`);
  const [joinCode, setJoinCode] = useState('');
  const [visibility, setVisibility] = useState<RoomVisibility>('private');
  const [publicRooms, setPublicRooms] = useState<RoomSummary[]>([]);
  const [isLoadingPublicRooms, setIsLoadingPublicRooms] = useState(true);
  const [publicRoomsError, setPublicRoomsError] = useState(false);

  useDocumentTitle('Word Bomb');

  const { createNewRoom, validateRoom } = useRoomActions();

  useEffect(() => {
    let cancelled = false;
    setIsLoadingPublicRooms(true);
    listPublicRooms()
      .then((rooms) => {
        if (cancelled) return;
        setPublicRooms(rooms.filter((room) => room.visibility === 'public'));
        setPublicRoomsError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPublicRooms([]);
        setPublicRoomsError(true);
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoadingPublicRooms(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    const code = await createNewRoom(roomName.trim(), visibility);
    void navigate(`/${code}`);
  };

  const handleJoinRoom = async () => {
    if (joinCode.length !== 4) return;
    const validation = await validateRoom(joinCode);
    if (!validation.exists) {
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
                <fieldset className="space-y-2">
                  <legend
                    id="room-visibility-label"
                    className="text-sm font-medium text-indigo-200"
                  >
                    Room visibility
                  </legend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label
                      className={`block rounded-lg border px-4 py-3 transition focus-within:ring-2 focus-within:ring-emerald-400 ${
                        visibility === 'public'
                          ? 'border-emerald-400/60 bg-emerald-500/10 shadow-inner'
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <input
                        type="radio"
                        name="roomVisibility"
                        value="public"
                        checked={visibility === 'public'}
                        onChange={() => {
                          setVisibility('public');
                        }}
                        className="sr-only"
                        aria-label="Public room"
                      />
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20">
                            <FaGlobe
                              className="h-4 w-4 text-emerald-300"
                              aria-hidden
                            />
                          </span>
                          <span className="text-sm font-semibold text-white">
                            Public
                          </span>
                        </div>
                        <p className="text-xs leading-snug text-indigo-200">
                          Listed on the home screen for anyone to join.
                        </p>
                      </div>
                    </label>
                    <label
                      className={`block rounded-lg border px-4 py-3 transition focus-within:ring-2 focus-within:ring-emerald-400 ${
                        visibility === 'private'
                          ? 'border-emerald-400/60 bg-emerald-500/10 shadow-inner'
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <input
                        type="radio"
                        name="roomVisibility"
                        value="private"
                        checked={visibility === 'private'}
                        onChange={() => {
                          setVisibility('private');
                        }}
                        className="sr-only"
                        aria-label="Private room"
                      />
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/20">
                            <FaLock
                              className="h-4 w-4 text-purple-200"
                              aria-hidden
                            />
                          </span>
                          <span className="text-sm font-semibold text-white">
                            Private
                          </span>
                        </div>
                        <p className="text-xs leading-snug text-indigo-200">
                          Share the invite link or code to play with friends.
                        </p>
                      </div>
                    </label>
                  </div>
                </fieldset>
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

      <section
        className="mt-12 w-full max-w-5xl"
        aria-labelledby="public-rooms-heading"
      >
        <div className="rounded-3xl border border-white/10 bg-indigo-900/30 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-sm">
          <header className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                id="public-rooms-heading"
                className="text-2xl font-semibold text-white"
              >
                Public Rooms
              </h2>
              <p className="text-sm text-indigo-200">
                Jump into a lobby ready for new challengers.
              </p>
            </div>
          </header>

          {publicRoomsError ? (
            <p
              role="alert"
              className="rounded-lg border border-red-400/50 bg-red-500/10 px-4 py-3 text-sm text-red-200"
            >
              Unable to load public rooms right now. Please try again shortly.
            </p>
          ) : isLoadingPublicRooms ? (
            <p
              role="status"
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-indigo-200"
            >
              Loading public rooms...
            </p>
          ) : publicRooms.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-indigo-200">
              No public rooms yet. Create one and invite friends to join the
              fun!
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {publicRooms.map((room) => {
                const trimmedName = room.name.trim();
                const displayName =
                  trimmedName.length > 0 ? trimmedName : `Room ${room.code}`;
                const playerLabel = `${room.playerCount} ${
                  room.playerCount === 1 ? 'player' : 'players'
                }`;
                return (
                  <button
                    type="button"
                    key={room.code}
                    onClick={() => {
                      void navigate(`/${room.code}`);
                    }}
                    className="group flex w-full flex-col justify-between rounded-xl border border-white/10 bg-white/5 p-5 text-left transition hover:border-emerald-400/60 hover:bg-white/10 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                    aria-label={`Join ${displayName}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          {displayName}
                        </h3>
                        <p className="text-xs uppercase tracking-widest text-indigo-200">
                          Code:{' '}
                          <span className="font-mono text-indigo-100">
                            {room.code}
                          </span>
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-200">
                        {playerLabel}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-indigo-200">
                      Click to join instantly.
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-12 text-center text-sm leading-relaxed text-indigo-300">
        Challenge friends with quick thinking and wordplay
      </footer>
    </div>
  );
}
