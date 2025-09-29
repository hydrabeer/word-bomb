import { useEffect, useState } from 'react';
import { type GameState } from '../components/GameBoard.tsx';

export type VisualState = 'idle' | 'seated' | 'playing';

interface Params {
  seatedCount?: number; // optional: can derive from players list separately
  gameState: GameState | null;
}

export function useVisualState({
  seatedCount = 0,
  gameState,
}: Params): VisualState {
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
