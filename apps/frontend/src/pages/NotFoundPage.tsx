import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-950 to-purple-900 px-6 text-center text-white">
      <h1 className="mb-4 text-6xl font-bold tracking-tight">404</h1>
      <p className="mb-8 max-w-md text-lg leading-relaxed text-indigo-200">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        to="/"
        className="rounded-md bg-emerald-500 px-4 py-3 text-base font-medium text-black shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-900 active:scale-95"
        aria-label="Go back home"
      >
        Go Home
      </Link>
    </div>
  );
}
