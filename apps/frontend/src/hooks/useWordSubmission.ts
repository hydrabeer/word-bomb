// apps/frontend/src/hooks/useWordSubmission.ts
import { useState, useCallback, useEffect } from 'react';
import { socket } from '../socket';
import { parseActionAck } from '../socket/parsers';

export function useWordSubmission(roomCode: string, playerId: string) {
  const [inputWord, setInputWord] = useState('');
  const [rejected, setRejected] = useState(false);

  // Track pending optimistic actions
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    function handleAck(raw: unknown) {
      const parsed = parseActionAck(raw);
      if (!parsed) return;
      const { clientActionId, success } = parsed;
      if (!pendingIds.has(clientActionId)) return;
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(clientActionId);
        return next;
      });
      if (!success) {
        setRejected(true);
        setTimeout(() => {
          setRejected(false);
        }, 300);
      }
    }
    socket.on('actionAck', handleAck);
    return () => {
      socket.off('actionAck', handleAck);
    };
  }, [pendingIds]);

  const handleSubmitWord = useCallback(() => {
    if (!inputWord.trim()) return;
    const clientActionId = `submit-${String(Date.now())}-${Math.random().toString(36).slice(2)}`;
    setPendingIds((prev) => new Set(prev).add(clientActionId));
    // Optimistic clear
    setInputWord('');
    socket.emit('submitWord', {
      roomCode,
      playerId,
      word: inputWord,
      clientActionId,
    });
  }, [roomCode, playerId, inputWord]);

  return {
    inputWord,
    setInputWord,
    rejected,
    isPending: pendingIds.size > 0,
    handleSubmitWord,
  };
}
