import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import RoomPage from './RoomPage';
import RoomNotFoundPage from './RoomNotFoundPage';
import NotFoundPage from './NotFoundPage';
import { checkRoomExists, type RoomVisibility } from '../api/rooms';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

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
  const [roomVisibility, setRoomVisibility] =
    useState<RoomVisibility>('private');

  useEffect(() => {
    let cancelled = false;
    // Defensive: Should only mount when pattern matches, but guard anyway
    if (!/^[A-Z]{4}$/.exec(roomCode)) {
      setStatus('invalidFormat');
      return;
    }
    setStatus('loading');
    setRoomName('');
    setRoomVisibility('private');
    checkRoomExists(roomCode)
      .then((res) => {
        if (cancelled) return;
        if (!res.exists) {
          setStatus('notfound');
          return;
        }
        setRoomName(res.name ?? '');
        setRoomVisibility(res.visibility ?? 'private');
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

  const title = useMemo(() => {
    if (status === 'loading') {
      return roomCode
        ? `Loading Room ${roomCode} — Word Bomb`
        : 'Loading Room — Word Bomb';
    }
    if (status === 'ready') {
      const trimmed = roomName.trim();
      const label = trimmed.length > 0 ? trimmed : roomName;
      return `[${roomCode}] ${label}`;
    }
    return undefined;
  }, [roomCode, roomName, status]);

  useDocumentTitle(title);

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

  return <RoomPage roomName={roomName} visibility={roomVisibility} />;
}
