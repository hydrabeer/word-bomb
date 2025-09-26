import { describe, it, expect } from 'vitest';
import { gameEngines } from '../src/game/engineRegistry';
import type { GameEngine } from '../src/game/GameEngine';

describe('engineRegistry coverage', () => {
  it('set/get/delete/clear work as expected', () => {
    const e1 = { tag: 'e1' } as unknown as GameEngine;
    const e2 = { tag: 'e2' } as unknown as GameEngine;
    gameEngines.clear();
    gameEngines.set('A', e1);
    expect(gameEngines.get('A')).toBe(e1);
    gameEngines.set('B', e2);
    expect(gameEngines.get('B')).toBe(e2);
    gameEngines.delete('A');
    expect(gameEngines.get('A')).toBeUndefined();
    gameEngines.clear();
    expect(gameEngines.get('B')).toBeUndefined();
  });
});
