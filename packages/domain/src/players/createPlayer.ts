// packages/domain/src/players/createPlayer.ts
import { Player } from './Player';
import { BonusProgress } from '../game/BonusProgress';

export interface CreatePlayerOptions {
  id: string;
  name: string;
  isLeader?: boolean;
  lives: number;
  bonusTemplate: number[];
}

export function createPlayer({
  id,
  name,
  isLeader = false,
  lives,
  bonusTemplate,
}: CreatePlayerOptions): Player {
  return new Player({
    id,
    name,
    isLeader,
    isSeated: false,
    isEliminated: false,
    isConnected: true,
    lives,
    bonusProgress: new BonusProgress(bonusTemplate),
  });
}
