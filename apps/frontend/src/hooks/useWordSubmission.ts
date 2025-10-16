// apps/frontend/src/hooks/useWordSubmission.ts
import { useState, useCallback, useEffect } from 'react';
import { socket } from '../socket';
import { parseActionAck } from '../socket/parsers';

export function useWordSubmission(roomCode: string, playerId: string) {
  const [inputWord, setInputWord] = useState('');
  const [rejected, setRejected] = useState(false);
  const [pendingActions, setPendingActions] = useState<
    Map<string, { word: string }>
  >(new Map());

  useEffect(() => {
    function handleAck(raw: unknown) {
      const parsed = parseActionAck(raw);
      if (!parsed) return;
      const { clientActionId, success } = parsed;
      setPendingActions((prev) => {
        if (!prev.has(clientActionId)) {
          return prev;
        }
        const next = new Map(prev);
        const pendingAction = next.get(clientActionId);
        next.delete(clientActionId);
        if (!success && pendingAction) {
          setRejected(true);
          setInputWord((current) => current || pendingAction.word);
          setTimeout(() => {
            setRejected(false);
          }, 300);
        }
        return next;
      });
    }
    socket.on('actionAck', handleAck);
    return () => {
      socket.off('actionAck', handleAck);
    };
  }, []);

  const handleSubmitWord = useCallback(() => {
    if (!inputWord.trim()) return;
    const wordToSubmit = inputWord;
    const clientActionId = `submit-${String(Date.now())}-${Math.random().toString(36).slice(2)}`;
    setPendingActions((prev) => {
      const next = new Map(prev);
      next.set(clientActionId, { word: wordToSubmit });
      return next;
    });
    // Optimistic clear
    setInputWord('');
    socket.emit('submitWord', {
      roomCode,
      playerId,
      word: wordToSubmit,
      clientActionId,
    });
  }, [roomCode, playerId, inputWord]);

  return {
    inputWord,
    setInputWord,
    rejected,
    isPending: pendingActions.size > 0,
    handleSubmitWord,
  };
}
