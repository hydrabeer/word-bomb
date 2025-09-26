import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { socket } from '../socket';

/**
 * Listens for socket-level disconnect events and navigates to the /disconnected
 * page with context query params so the user can attempt reconnection.
 */
export function useSocketConnection() {
  const navigate = useNavigate();
  const { roomCode } = useParams<{ roomCode: string }>();

  useEffect(() => {
    const handleDisconnect = (reason: string) => {
      // Avoid duplicate navigation if already on disconnected page
      if (window.location.pathname === '/disconnected') return;

      const qp = new URLSearchParams();
      if (roomCode) qp.set('room', roomCode);
      qp.set('reason', reason || 'network');
      void navigate(`/disconnected?${qp.toString()}`);
    };

    socket.on('disconnect', handleDisconnect);
    return () => {
      socket.off('disconnect', handleDisconnect);
    };
  }, [navigate, roomCode]);
}
