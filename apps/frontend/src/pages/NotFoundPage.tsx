import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    mainRef.current?.focus();
    document.title = '404 — Page Not Found';
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-950 to-purple-900 px-6 text-white">
      <main
        ref={mainRef as unknown as React.RefObject<HTMLElement>}
        role="main"
        tabIndex={-1}
        aria-labelledby="notfound-heading"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-xl backdrop-blur-sm"
      >
        <h1 id="notfound-heading" className="mb-4 text-3xl font-bold">
          404
        </h1>
        <p className="mb-8 text-base leading-relaxed text-indigo-200">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-black no-underline shadow-lg shadow-emerald-500/20 transition-colors visited:text-black hover:bg-emerald-400 hover:no-underline focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-900 active:scale-95"
        >
          Go Home
        </Link>
      </main>
    </div>
  );
}
