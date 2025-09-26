import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  roomCode: string;
}

export default function RoomNotFoundPage({ roomCode }: Props) {
  const mainRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    mainRef.current?.focus();
    document.title = `Room Not Found — ${roomCode}`;
  }, [roomCode]);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-950 to-purple-900 px-6 text-white">
      <main
        ref={mainRef as unknown as React.RefObject<HTMLElement>}
        role="main"
        tabIndex={-1}
        aria-labelledby="room-not-found-heading"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-xl backdrop-blur-sm"
      >
        <h1 id="room-not-found-heading" className="mb-4 text-3xl font-bold tracking-tight">Room Not Found</h1>
        <p className="mb-6 text-base leading-relaxed text-indigo-200">
          The room <span className="font-mono text-emerald-300">{roomCode}</span>{' '}
          doesn&apos;t exist anymore.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-black shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-900 active:scale-95 no-underline hover:no-underline visited:text-black"
          >
            Go Home
          </Link>
        </div>
      </main>
    </div>
  );
}
