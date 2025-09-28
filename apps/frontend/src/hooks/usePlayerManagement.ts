// apps/frontend/src/hooks/usePlayerManagement.ts
import { useState, useEffect, useMemo } from 'react';
import { socket } from '../socket';
import type {
  PlayersUpdatedPayload,
  PlayersDiffPayload,
} from '@word-bomb/types';
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

    function handlePlayersDiff(diff: PlayersDiffPayload) {
      setPlayers((prev) => {
        let next = [...prev];
        if (diff.removed.length) {
          const removedSet = new Set(diff.removed);
          next = next.filter((p) => !removedSet.has(p.id));
        }
        if (diff.added.length) {
          next = next.concat(
            diff.added.map((a) => ({
              id: a.id,
              name: a.name,
              isSeated: a.isSeated,
            })),
          );
        }
        if (diff.updated.length) {
          const updatesMap = new Map(
            diff.updated.map((u) => [u.id, u.changes]),
          );
          next = next.map((p) => {
            const changes = updatesMap.get(p.id);
            return changes ? { ...p, ...changes } : p;
          });
        }
        return next;
      });
      if (diff.leaderIdChanged !== undefined) {
        setLeaderId(diff.leaderIdChanged);
      }
    }

    socket.on('playersUpdated', handlePlayersUpdated);
    socket.on('playersDiff', handlePlayersDiff);
    return () => {
      socket.off('playersUpdated', handlePlayersUpdated);
      socket.off('playersDiff', handlePlayersDiff);
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
