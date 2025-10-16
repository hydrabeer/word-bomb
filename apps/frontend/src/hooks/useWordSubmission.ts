// apps/frontend/src/hooks/useWordSubmission.ts
import { useState, useCallback, useEffect } from 'react';
import { socket } from '../socket';
import { parseActionAck } from '../socket/parsers';

export function useWordSubmission(roomCode: string, playerId: string) {
  const [inputWord, setInputWord] = useState('');
  const [rejected, setRejected] = useState(false);

  // Track pending optimistic actions along with the submitted word
  const [pendingSubmissions, setPendingSubmissions] = useState<Map<string, string>>(
    () => new Map(),
  );

  useEffect(() => {
    function handleAck(raw: unknown) {
      const parsed = parseActionAck(raw);
      if (!parsed) return;
      const { clientActionId, success } = parsed;
      const submittedWord = pendingSubmissions.get(clientActionId);
      if (!submittedWord) return;
      setPendingSubmissions((prev) => {
        const next = new Map(prev);
        next.delete(clientActionId);
        return next;
      });
      if (!success) {
        setInputWord((prev) => (prev ? prev : submittedWord));
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
  }, [pendingSubmissions]);

  const handleSubmitWord = useCallback(() => {
    if (!inputWord.trim()) return;
    const clientActionId = `submit-${String(Date.now())}-${Math.random().toString(36).slice(2)}`;
    const submittedWord = inputWord;
    setPendingSubmissions((prev) => {
      const next = new Map(prev);
      next.set(clientActionId, submittedWord);
      return next;
    });
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
    isPending: pendingSubmissions.size > 0,
    handleSubmitWord,
  };
}
