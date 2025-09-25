// apps/frontend/src/hooks/useWordSubmission.ts
import { useState, useCallback, useEffect } from 'react';
import { socket } from '../socket';
import type { ActionAckPayload } from '@game/domain/socket/types';

export function useWordSubmission(roomCode: string, playerId: string) {
  const [inputWord, setInputWord] = useState('');
  const [rejected, setRejected] = useState(false);

  // Track pending optimistic actions
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    function handleAck(data: ActionAckPayload) {
      if (!pendingIds.has(data.clientActionId)) return;
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(data.clientActionId);
        return next;
      });
      if (data.success) {
        // Already cleared input optimistically
      } else {
        setRejected(true);
        setTimeout(() => setRejected(false), 300);
      }
    }
    socket.on('actionAck', handleAck);
    return () => {
      socket.off('actionAck', handleAck);
    };
  }, [pendingIds]);

  const handleSubmitWord = useCallback(() => {
    if (!inputWord.trim()) return;
    const clientActionId = `submit-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setPendingIds((prev) => new Set(prev).add(clientActionId));
    // Optimistic clear
    setInputWord('');
    socket.emit('submitWord', { roomCode, playerId, word: inputWord, clientActionId });
  }, [roomCode, playerId, inputWord]);

  return {
    inputWord,
    setInputWord,
    rejected,
    isPending: pendingIds.size > 0,
    handleSubmitWord,
  };
}
