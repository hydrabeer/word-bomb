import { Link } from 'react-router-dom';

interface Props {
  roomCode: string;
}

export default function RoomNotFoundPage({ roomCode }: Props) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-950 to-purple-900 px-6 text-center text-white">
      <h1 className="mb-4 text-4xl font-bold tracking-tight">Room Not Found</h1>
      <p className="mb-4 max-w-lg text-lg leading-relaxed text-indigo-200">
        The room <span className="font-mono text-emerald-300">{roomCode}</span>{' '}
        doesn&apos;t exist anymore (or never existed). It may have expired or
        the code was mistyped.
      </p>
      <div className="flex flex-col gap-4 sm:flex-row">
        <Link
          to="/"
          className="rounded-md bg-white/10 px-6 py-3 text-base font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-400 active:scale-95"
          aria-label="Go back home"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
