import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { socket } from '../socket';
import { getOrCreatePlayerProfile } from '../utils/playerProfile';

export default function DisconnectedPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roomCode = searchParams.get('room') ?? '';
  const reason = searchParams.get('reason') ?? 'connection lost';
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<
    'idle' | 'reconnecting' | 'failed' | 'success'
  >('idle');
  const mainRef = useRef<HTMLElement | null>(null);
  const intervalRef = useRef<number | null>(null);
  const failSafeRef = useRef<number | null>(null);
  const statusRef = useRef<'idle' | 'reconnecting' | 'failed' | 'success'>(
    'idle',
  );
  const attemptRef = useRef(0);
  const connectHandlerRef = useRef<((...args: unknown[]) => void) | null>(null);
  const connectErrorHandlerRef = useRef<((...args: unknown[]) => void) | null>(
    null,
  );
  const MAX_ATTEMPTS = 5;

  const handleReturnHome = () => {
    void navigate('/');
  };

  // Keep statusRef in sync to avoid stale closures inside timers
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    attemptRef.current = attempt;
  }, [attempt]);
  // Focus the main region on mount for screen reader context
  useEffect(() => {
    mainRef.current?.focus();
  }, []);
  // Keep the document title informative
  useEffect(() => {
    const base = 'Disconnected';
    if (status === 'reconnecting') {
      document.title = `${base} — Reconnecting (attempt ${String(attempt)}/${String(MAX_ATTEMPTS)})`;
    } else if (status === 'success') {
      document.title = `${base} — Reconnected`;
    } else if (status === 'failed') {
      document.title = `${base} — Retry failed`;
    } else {
      document.title = base;
    }
  }, [status, attempt]);

  const tryReconnect = useCallback(() => {
    // clear any pending scheduled retry before starting a fresh attempt
    if (intervalRef.current) {
      window.clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }
    // clear any previous failsafe timer
    if (failSafeRef.current) {
      window.clearTimeout(failSafeRef.current);
      failSafeRef.current = null;
    }
    if (statusRef.current === 'reconnecting') return;
    setStatus('reconnecting');
    setAttempt((a) => a + 1);

    if (!socket.connected) {
      socket.connect();
    }

    // When connected, optionally rejoin room
    // Remove any previous listeners to avoid multiple handlers piling up
    const remove = (
      event: 'connect' | 'connect_error',
      handler: ((...args: unknown[]) => void) | null,
    ) => {
      if (!handler) return;
      const anySock = socket as unknown as {
        off?: (e: string, h: (...a: unknown[]) => void) => void;
        removeListener?: (e: string, h: (...a: unknown[]) => void) => void;
      };
      if (typeof anySock.off === 'function') anySock.off(event, handler);
      else if (typeof anySock.removeListener === 'function')
        anySock.removeListener(event, handler);
    };
    if (connectHandlerRef.current) remove('connect', connectHandlerRef.current);
    if (connectErrorHandlerRef.current)
      remove('connect_error', connectErrorHandlerRef.current);

    const onConnect = () => {
      setStatus('success');
      // clear any pending timers
      if (intervalRef.current) window.clearTimeout(intervalRef.current);
      if (failSafeRef.current) window.clearTimeout(failSafeRef.current);
      // best-effort cleanup of the error handler if still present
      if (connectErrorHandlerRef.current) {
        remove('connect_error', connectErrorHandlerRef.current);
        connectErrorHandlerRef.current = null;
      }
      if (roomCode) {
        const { id: playerId, name } = getOrCreatePlayerProfile();
        socket.emit('joinRoom', { roomCode, playerId, name }, () => {
          void navigate(`/${roomCode}`);
        });
      } else {
        // No room remembered, go home after slight delay for UX
        setTimeout(() => void navigate('/'), 400);
      }
    };

    const onConnectError = () => {
      setStatus('failed');
      // cleanup connect listener to avoid firing on a later successful connect from a new attempt
      if (connectHandlerRef.current) {
        remove('connect', connectHandlerRef.current);
        connectHandlerRef.current = null;
      }
      // schedule a retry only on explicit connect_error
      if (attemptRef.current < MAX_ATTEMPTS) {
        if (intervalRef.current) window.clearTimeout(intervalRef.current);
        intervalRef.current = window.setTimeout(() => {
          tryReconnect();
        }, 1500) as unknown as number;
      }
    };

    socket.once('connect', onConnect);
    socket.once('connect_error', onConnectError);
    connectHandlerRef.current = onConnect;
    connectErrorHandlerRef.current = onConnectError;

    // Failsafe timeout
    failSafeRef.current = window.setTimeout(() => {
      // Avoid stale status by using refs and checking live socket state
      if (!socket.connected && statusRef.current !== 'success') {
        setStatus('failed');
      }
    }, 4000) as unknown as number;
  }, [navigate, roomCode]);

  // Auto retry
  useEffect(() => {
    if (status === 'success') {
      if (intervalRef.current) window.clearTimeout(intervalRef.current);
      if (failSafeRef.current) window.clearTimeout(failSafeRef.current);
      return;
    }
    if (attempt === 0) {
      tryReconnect();
      return;
    }
    return () => {
      // do not clear failsafe here; it is managed per-attempt and on success/unmount
    };
  }, [status, attempt, tryReconnect]);

  // On unmount, ensure timers and any listeners are cleaned up
  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearTimeout(intervalRef.current);
      if (failSafeRef.current) window.clearTimeout(failSafeRef.current);
      const anySock = socket as unknown as {
        off?: (e: string, h: (...a: unknown[]) => void) => void;
        removeListener?: (e: string, h: (...a: unknown[]) => void) => void;
      };
      if (connectHandlerRef.current) {
        if (typeof anySock.off === 'function')
          anySock.off('connect', connectHandlerRef.current);
        else if (typeof anySock.removeListener === 'function')
          anySock.removeListener('connect', connectHandlerRef.current);
      }
      if (connectErrorHandlerRef.current) {
        if (typeof anySock.off === 'function')
          anySock.off('connect_error', connectErrorHandlerRef.current);
        else if (typeof anySock.removeListener === 'function')
          anySock.removeListener(
            'connect_error',
            connectErrorHandlerRef.current,
          );
      }
    };
  }, []);

  const progressMessage = (() => {
    switch (status) {
      case 'reconnecting':
        return `Reconnecting (attempt ${String(attempt)}/${String(MAX_ATTEMPTS)})...`;
      case 'failed':
        return attempt >= MAX_ATTEMPTS
          ? 'Unable to reconnect automatically.'
          : 'Retry failed.';
      case 'success':
        return 'Reconnected! Redirecting...';
      default:
        return 'Idle';
    }
  })();

  return (
    <div className="flex min-h-screen w-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-950 to-purple-900 p-6 text-white">
      <main
        ref={mainRef as unknown as React.RefObject<HTMLElement>}
        role="main"
        tabIndex={-1}
        aria-labelledby="disconnected-heading"
        aria-describedby="disconnected-reason"
        aria-busy={status === 'reconnecting'}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-xl backdrop-blur-sm"
      >
        <h1 id="disconnected-heading" className="mb-4 text-3xl font-bold">
          Disconnected
        </h1>
        <p id="disconnected-reason" className="mb-2 text-indigo-200">
          Reason: {reason}
        </p>
        {roomCode && (
          <p className="mb-4 text-sm text-indigo-300">
            Previous room: {roomCode}
          </p>
        )}
        <p
          className="mb-6 text-sm text-indigo-300"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {progressMessage}
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={tryReconnect}
            disabled={status === 'reconnecting' || attempt >= MAX_ATTEMPTS}
            className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-black shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {status === 'reconnecting' ? 'Reconnecting...' : 'Try Again'}
          </button>
          <button
            onClick={handleReturnHome}
            className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-black shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-900 active:scale-95"
          >
            Home
          </button>
        </div>
      </main>
    </div>
  );
}
