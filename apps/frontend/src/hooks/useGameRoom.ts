import { useEffect } from 'react';
import { socket } from '../socket';
import { getOrCreatePlayerProfile } from '../utils/playerProfile';

// Shared state to track where the socket *thinks* it is
let latestRoomJoined: string | null = null;

export function useGameRoom(roomCode: string) {
  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    const { id: playerId, name } = getOrCreatePlayerProfile();

    latestRoomJoined = roomCode;

    socket.emit(
      'joinRoom',
      {
        roomCode,
        playerId,
        name,
      },
      (res: any) => {
        if (res && !res.success) {
          console.log('joinRoom error:', res.error);
        }
      },
    );

    return () => {
      // Only leave if we're not immediately rejoining this room
      setTimeout(() => {
        if (latestRoomJoined !== roomCode) {
          socket.emit('leaveRoom', { roomCode, playerId });
        }
      }, 100);
    };
  }, [roomCode]);
}
