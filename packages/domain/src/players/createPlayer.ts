// packages/domain/src/players/PlayerFactory.ts
import { Player, PlayerProps } from './Player';
import { BonusProgress } from '../game/BonusProgress';

export interface CreatePlayerOptions {
  props: Omit<PlayerProps, 'bonusProgress'>;
  bonusTemplate: number[]; // e.g. [1,1,...] of length 26
}

export function createPlayer({
  props,
  bonusTemplate,
}: CreatePlayerOptions): Player {
  const bonus = new BonusProgress(bonusTemplate);
  return new Player({ ...props, bonusProgress: bonus });
}
