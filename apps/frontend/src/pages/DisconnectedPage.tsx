import { useEffect, useRef, useState } from 'react';
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
  const MAX_ATTEMPTS = 5;

  const handleReturnHome = () => {
    void navigate('/');
  };

  const tryReconnect = () => {
    if (status === 'reconnecting') return;
    setStatus('reconnecting');
    setAttempt((a) => a + 1);

    if (!socket.connected) {
      socket.connect();
    }

    // When connected, optionally rejoin room
    const onConnect = () => {
      setStatus('success');
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
    };

    socket.once('connect', onConnect);
    socket.once('connect_error', onConnectError);

    // Failsafe timeout
    window.setTimeout(() => {
      if (!socket.connected && status !== 'success') {
        setStatus('failed');
      }
    }, 4000);
  };

  // Auto retry
  useEffect(() => {
    if (status === 'success') {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      return;
    }
    if (attempt === 0) {
      tryReconnect();
      return;
    }
    if (status === 'failed' && attempt < MAX_ATTEMPTS) {
      intervalRef.current = window.setTimeout(() => {
        tryReconnect();
      }, 1500) as unknown as number;
    }
    return () => {
      if (intervalRef.current) window.clearTimeout(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, attempt]);

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
