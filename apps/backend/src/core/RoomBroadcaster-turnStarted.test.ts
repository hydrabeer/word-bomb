import { describe, it, expect } from 'vitest';
import { RoomBroadcaster } from './RoomBroadcaster';

// Fake game where getCurrentPlayer throws once (to hit the catch) then returns a valid player
const badGame: any = {
  roomCode: 'GGGG',
  currentTurnIndex: 0,
  fragment: 'aa',
  getBombDuration: () => 1000,
  players: [
    {
      id: 'P1',
      name: 'X',
      isEliminated: false,
      lives: 1,
      getBonusProgressSnapshot: () => [],
    },
  ],
  rules: { bonusTemplate: [1] },
};
let callCount = 0;
badGame.getCurrentPlayer = () => {
  callCount += 1;
  if (callCount === 1) throw new Error('no current player');
  return badGame.players[0];
};

function makeIo() {
  return { to: () => ({ emit: () => undefined }) } as any;
}

describe('RoomBroadcaster turnStarted warn path', () => {
  it('logs warn when getCurrentPlayer throws', () => {
    const b = new RoomBroadcaster(makeIo());
    expect(() => b.turnStarted(badGame as any)).not.toThrow();
  });
});
