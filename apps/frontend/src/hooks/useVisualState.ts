import { useEffect, useState } from 'react';
import { GameState } from '../components/GameBoard.tsx';

export type VisualState = 'idle' | 'seated' | 'playing';

export function useVisualState({
  seatedCount,
  gameState,
}: {
  seatedCount: number;
  gameState: GameState | null;
}): VisualState {
  const [visualState, setVisualState] = useState<VisualState>('idle');

  useEffect(() => {
    if (gameState) {
      setVisualState('playing');
    } else if (seatedCount >= 1) {
      setVisualState('seated');
    } else {
      setVisualState('idle');
    }
  }, [gameState, seatedCount]);

  return visualState;
}
