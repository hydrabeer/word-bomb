import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { socket } from '../socket';
import { getOrCreatePlayerProfile } from '../utils/playerProfile';

export default function DisconnectedPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roomCode = searchParams.get('room') || '';
  const reason = searchParams.get('reason') || 'connection lost';
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<
    'idle' | 'reconnecting' | 'failed' | 'success'
  >('idle');
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
        return `Reconnecting (attempt ${attempt}/${MAX_ATTEMPTS})...`;
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
    <div className="flex min-h-screen w-screen flex-col items-center justify-center bg-gray-900 p-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur-sm">
        <h1 className="mb-4 text-3xl font-bold">Disconnected</h1>
        <p className="mb-2 text-indigo-200">Reason: {reason}</p>
        {roomCode && (
          <p className="mb-4 text-sm text-indigo-300">
            Previous room: {roomCode}
          </p>
        )}
        <p className="mb-6 text-sm text-indigo-300">{progressMessage}</p>
        <div className="flex flex-col gap-3">
          <button
            onClick={tryReconnect}
            disabled={status === 'reconnecting' || attempt >= MAX_ATTEMPTS}
            aria-label="Try Again"
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-black hover:enabled:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {status === 'reconnecting' ? 'Reconnecting...' : 'Try Again'}
          </button>
          <button
            onClick={handleReturnHome}
            className="rounded border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
