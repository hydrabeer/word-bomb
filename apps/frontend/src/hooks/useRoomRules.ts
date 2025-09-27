import { useState, useEffect, useCallback, useMemo } from 'react';
import { socket } from '../socket';
import { parseRoomRulesUpdated } from '../socket/parsers';

// Local copy of rules shape to avoid cross-package type resolution issues in strict linting
export interface LobbyRules {
  maxLives: number;
  startingLives: number;
  bonusTemplate: number[];
  minTurnDuration: number;
  minWordsPerPrompt: number;
}

export interface BasicResponse {
  success: boolean;
  error?: string;
}

const DEFAULT_RULES: LobbyRules = {
  maxLives: 3,
  startingLives: 3,
  bonusTemplate: Array.from({ length: 26 }, () => 1),
  minTurnDuration: 5,
  minWordsPerPrompt: 500,
};

export interface UseRoomRulesResult {
  rules: LobbyRules;
  hasServerRules: boolean;
  isUpdating: boolean;
  error: string | null;
  updateRules: (next: LobbyRules) => Promise<BasicResponse>;
}

export function useRoomRules(roomCode: string): UseRoomRulesResult {
  const [rules, setRules] = useState<LobbyRules | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRules(null);
    setError(null);
  }, [roomCode]);

  useEffect(() => {
    function handleRules(raw: unknown) {
      const parsed = parseRoomRulesUpdated(raw);
      if (!parsed || parsed.roomCode !== roomCode) return;
      setRules(parsed.rules);
      setError(null);
    }

    socket.on('roomRulesUpdated', handleRules);
    return () => {
      socket.off('roomRulesUpdated', handleRules);
    };
  }, [roomCode]);

  const currentRules = useMemo<LobbyRules>(() => {
    const source: LobbyRules = rules ?? DEFAULT_RULES;
    // copy arrays to avoid accidental mutation from consumers
    return {
      ...source,
      bonusTemplate: [...source.bonusTemplate],
    };
  }, [rules]);

  const updateRules = useCallback(
    (next: LobbyRules): Promise<BasicResponse> =>
      new Promise<BasicResponse>((resolve) => {
        setIsUpdating(true);
        setError(null);
        socket.emit('updateRoomRules', { roomCode, rules: next }, (res) => {
          const response = res ?? {
            success: false,
            error: 'No response from server.',
          };
          if (!response.success) {
            setError(response.error ?? 'Failed to update rules.');
          }
          setIsUpdating(false);
          resolve(response);
        });
      }),
    [roomCode],
  );

  return {
    rules: currentRules,
    hasServerRules: rules != null,
    isUpdating,
    error,
    updateRules,
  };
}
