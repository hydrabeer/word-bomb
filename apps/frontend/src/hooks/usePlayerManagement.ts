// apps/frontend/src/hooks/usePlayerManagement.ts
import { useState, useEffect, useMemo } from 'react';
import { socket } from '../socket';
import type { PlayersUpdatedPayload } from '@game/domain/socket/types';
import { getOrCreatePlayerProfile } from '../utils/playerProfile';

export function usePlayerManagement(roomCode: string) {
  const [players, setPlayers] = useState<
    {
      id: string;
      name: string;
      isSeated: boolean;
    }[]
  >([]);
  const [leaderId, setLeaderId] = useState<string | null>(null);

  const { id: playerId, name: playerName } = getOrCreatePlayerProfile();
  const me = useMemo(
    () => players.find((p) => p.id === playerId),
    [players, playerId],
  );

  useEffect(() => {
    function handlePlayersUpdated(data: PlayersUpdatedPayload) {
      setPlayers(data.players);
      setLeaderId(data.leaderId ?? null);
    }

    socket.on('playersUpdated', handlePlayersUpdated);
    return () => {
      socket.off('playersUpdated', handlePlayersUpdated);
    };
  }, []);

  const toggleSeated = () => {
    const seated = !(me?.isSeated ?? false);
    socket.emit('setPlayerSeated', { roomCode, playerId, seated }, (res) => {
      if (res && !res.success) console.log('setPlayerSeated error:', res.error);
    });
  };

  const startGame = () => {
    socket.emit('startGame', { roomCode }, (res) => {
      if (!res.success) console.log(res.error);
    });
  };

  return {
    players,
    leaderId,
    playerId,
    playerName,
    me,
    toggleSeated,
    startGame,
  };
}
