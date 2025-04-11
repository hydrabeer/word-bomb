// apps/frontend/src/hooks/useWordSubmission.ts
import { useState, useCallback } from 'react';
import { socket } from '../socket';

export function useWordSubmission(roomCode: string, playerId: string) {
  const [inputWord, setInputWord] = useState('');
  const [rejected, setRejected] = useState(false);

  const handleSubmitWord = useCallback(() => {
    socket.emit(
      'submitWord',
      { roomCode, playerId, word: inputWord },
      (res) => {
        if (res.success) {
          setInputWord('');
        } else {
          setRejected(true);
          setTimeout(() => setRejected(false), 300);
          setInputWord('');
        }
      },
    );
  }, [roomCode, playerId, inputWord]);

  return {
    inputWord,
    setInputWord,
    rejected,
    handleSubmitWord,
  };
}
