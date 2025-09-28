import { useEffect } from 'react';
import { socket } from '../socket';
import { getOrCreatePlayerProfile } from '../utils/playerProfile';
// Avoid direct BasicResponse reliance in callback by runtime guard

// Shared state to track where the socket *thinks* it is
let latestRoomJoined: string | null = null;

export function useGameRoom(roomCode: string) {
  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    const { id: playerId, name } = getOrCreatePlayerProfile();

    latestRoomJoined = roomCode;

    // Defer the join emit slightly to ensure any socket listeners set up by
    // other hooks (invoked earlier in the render) are active before the
    // server immediately responds with gameStarted/turnStarted snapshots.
    const joinTimer = setTimeout(() => {
      socket.emit('joinRoom', { roomCode, playerId, name });
    }, 0);

    return () => {
      // Only leave if we're not immediately rejoining this room
      setTimeout(() => {
        if (latestRoomJoined !== roomCode) {
          socket.emit('leaveRoom', { roomCode, playerId });
        }
      }, 100);
      clearTimeout(joinTimer);
    };
  }, [roomCode]);
}
