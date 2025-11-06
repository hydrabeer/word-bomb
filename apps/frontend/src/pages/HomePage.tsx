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
  const defaultRoomName = (value: string) => `${value}'s room`;
  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [profileName, setProfileName] = useState(initialName);
  const [roomName, setRoomName] = useState(defaultRoomName(initialName));
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
    const previousDefaultRoomName = defaultRoomName(profileName);
    const nextDefaultRoomName = defaultRoomName(trimmed);
    updatePlayerName(trimmed);
    setProfileName(trimmed);
    setName(trimmed);
    if (roomName === previousDefaultRoomName) {
      setRoomName(nextDefaultRoomName);
    }
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

  const handleRoomNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.currentTarget.blur();
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-indigo-950 to-purple-900 text-white">
      <header className="w-full border-b border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-8 text-center">
          <h1 className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl">
            Word Bomb
          </h1>
        </div>
      </header>

      <main
        className="mx-auto w-full max-w-[min(92vw,1600px)] flex-1 px-4 pb-16"
        role="main"
      >
        <section
          id="quick-start"
          className="mt-8 rounded-3xl bg-indigo-900/40 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-sm lg:border lg:border-white/10 lg:p-8"
          aria-labelledby="quick-start-heading"
        >
          <div className="grid grid-cols-1 gap-6 sm:gap-8 xl:grid-cols-[minmax(260px,320px)_minmax(320px,1fr)_minmax(320px,1fr)] xl:items-stretch">
            <div className="flex flex-col gap-6">
              <div className="rounded-2xl border border-white/10 bg-indigo-950/30 p-6 text-left shadow-inner shadow-black/10">
                <h2
                  id="quick-start-heading"
                  className="text-2xl font-semibold text-white"
                >
                  Jump into a game
                </h2>
                <p className="mt-3 text-sm text-indigo-200">
                  Join with a code or host a lobby for friends.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-indigo-950/30 p-6 shadow-inner shadow-black/10">
                <header className="mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    Your profile
                  </h3>
                  <p className="text-sm text-indigo-200">
                    Set the name everyone sees in game.
                  </p>
                </header>
                <div className="space-y-4">
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
                        className="w-full rounded-lg border border-indigo-600/30 bg-indigo-900/40 px-4 py-3 text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        autoFocus
                        aria-label="Your display name"
                        aria-describedby="name-constraints"
                      />
                      <button
                        onClick={handleSaveName}
                        className="mt-2 whitespace-nowrap rounded-md bg-emerald-500 px-4 py-3 text-base font-medium text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-900 active:scale-95 sm:mt-0"
                        aria-label="Save name"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-3 text-xl font-medium text-indigo-100">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-base font-semibold text-black">
                          {name.charAt(0).toUpperCase()}
                        </span>
                        {name}
                      </span>
                      <button
                        onClick={() => {
                          setEditing(true);
                        }}
                        className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/20 focus:ring-2 focus:ring-emerald-400 active:scale-95"
                        aria-label="Edit your name"
                      >
                        Edit Name
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-indigo-300">
                    This name shows in chat, leaderboards, and lobby lists.
                  </p>
                  <p id="name-constraints" className="sr-only">
                    Name must be between 1 and 20 characters.
                  </p>
                </div>
              </div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleJoinRoom();
              }}
              className="flex min-h-full flex-1 flex-col gap-5 rounded-2xl border border-white/10 bg-indigo-950/40 p-6 shadow-inner shadow-black/20 backdrop-blur md:min-w-[280px] xl:self-stretch"
              aria-labelledby="join-room-heading"
            >
              <header className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-pink-500">
                  <span className="text-sm font-bold text-black">→</span>
                </span>
                <h3
                  id="join-room-heading"
                  className="text-xl font-semibold text-white"
                >
                  Join with a code
                </h3>
              </header>
              <div className="space-y-4 sm:space-y-5">
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
                    className="text-md w-full rounded-lg border border-indigo-600/30 bg-indigo-900/40 px-4 py-5 text-center tracking-widest text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 sm:text-xl lg:text-2xl"
                    aria-describedby="joincode-constraints"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-md bg-pink-400 px-4 py-3 text-base font-medium text-slate-950 shadow-lg shadow-pink-400/25 transition hover:bg-pink-300 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={joinCode.length !== 4}
                  aria-label="Join existing room"
                >
                  Join Room
                </button>
                <p className="text-center text-sm leading-relaxed text-indigo-200">
                  Enter the four letters and you are in.
                </p>
                <p id="joincode-constraints" className="sr-only">
                  Enter exactly four uppercase letters.
                </p>
              </div>
            </form>
            <form
              id="create-room-card"
              onSubmit={(e) => {
                e.preventDefault();
                void handleCreateRoom();
              }}
              className="flex min-h-full flex-1 flex-col gap-5 rounded-2xl border border-white/10 bg-indigo-950/40 p-6 shadow-inner shadow-black/20 backdrop-blur md:min-w-[280px] xl:self-stretch"
              aria-labelledby="create-room-heading"
            >
              <header className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-500">
                  <span className="text-sm font-bold text-black">+</span>
                </span>
                <h3
                  id="create-room-heading"
                  className="text-xl font-semibold text-white"
                >
                  Create a room
                </h3>
              </header>

              <div className="space-y-5">
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
                    onKeyDown={handleRoomNameKeyDown}
                    maxLength={30}
                    placeholder="Enter room name"
                    className="w-full rounded-lg border border-indigo-600/30 bg-indigo-900/40 px-4 py-3 text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    aria-describedby="roomname-constraints"
                  />
                </div>

                <fieldset className="space-y-3">
                  <legend
                    id="room-visibility-label"
                    className="text-sm font-medium text-indigo-200"
                  >
                    Room visibility
                  </legend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label
                      className={`block rounded-xl border px-4 py-3 transition focus-within:ring-2 focus-within:ring-emerald-400 ${
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
                          Appears in the public lobby list.
                        </p>
                      </div>
                    </label>
                    <label
                      className={`block rounded-xl border px-4 py-3 transition focus-within:ring-2 focus-within:ring-emerald-400 ${
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
                          Only accessible with your invite code.
                        </p>
                      </div>
                    </label>
                  </div>
                </fieldset>

                <button
                  type="submit"
                  className="w-full rounded-md bg-emerald-500 px-4 py-3 text-base font-medium text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!roomName.trim()}
                  aria-label="Create a new game room"
                >
                  Create &amp; Play
                </button>
                <p id="roomname-constraints" className="sr-only">
                  Room name up to 30 characters.
                </p>
              </div>
            </form>
          </div>
        </section>

        <section
          id="public-rooms"
          className="mt-12 rounded-3xl bg-indigo-900/40 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-sm lg:border lg:border-white/10 lg:p-8"
          aria-labelledby="public-rooms-heading"
        >
          <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                id="public-rooms-heading"
                className="text-2xl font-semibold text-white"
              >
                Public rooms
              </h2>
              <p className="text-sm text-indigo-200">
                One click joins any open lobby below.
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
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-12 text-center text-sm leading-relaxed text-indigo-300">
        Sharpen your vocabulary, outsmart the bomb, and celebrate the clutch
        plays with friends.
      </footer>
    </div>
  );
}
