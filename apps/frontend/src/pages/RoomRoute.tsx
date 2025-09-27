import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import RoomPage from './RoomPage';
import RoomNotFoundPage from './RoomNotFoundPage';
import NotFoundPage from './NotFoundPage';
import { checkRoomExists } from '../api/rooms';

// Status lifecycle:
//  - invalidFormat: URL segment is not a 4 uppercase letter code -> show 404 page
//  - loading: validating existence of a syntactically valid code
//  - notfound: code looked valid but backend reports no such room -> show RoomNotFoundPage
//  - ready: room exists -> render RoomPage
type Status = 'invalidFormat' | 'loading' | 'notfound' | 'ready';

export default function RoomRoute() {
  const { roomCode = '' } = useParams<{ roomCode: string }>();
  const [status, setStatus] = useState<Status>('loading');
  const [roomName, setRoomName] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    // Defensive: Should only mount when pattern matches, but guard anyway
    if (!roomCode.match(/^[A-Z]{4}$/)) {
      setStatus('invalidFormat');
      return;
    }
    setStatus('loading');
    checkRoomExists(roomCode)
      .then((res) => {
        if (cancelled) return;
        if (!res.exists) {
          setStatus('notfound');
          return;
        }
        setRoomName(res.name ?? '');
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('notfound');
      });
    return () => {
      cancelled = true;
    };
  }, [roomCode]);

  if (status === 'invalidFormat') {
    return <NotFoundPage />;
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-950 to-purple-900 text-white">
        <div className="animate-pulse rounded-xl border border-white/10 bg-white/5 px-8 py-6 text-lg font-medium text-indigo-200 shadow-lg backdrop-blur-sm">
          Loading room {roomCode}...
        </div>
      </div>
    );
  }

  if (status === 'notfound') {
    return <RoomNotFoundPage roomCode={roomCode} />;
  }

  // Set tab title as soon as we know the room name
  if (roomName) {
    document.title = `[${roomCode}] ${roomName}`;
  }

  return <RoomPage roomName={roomName} />;
}
