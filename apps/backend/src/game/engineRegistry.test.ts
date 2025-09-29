import { describe, it, expect } from 'vitest';
import {
  gameEngines,
  setGameEngine,
  getGameEngine,
  shutdownEngines,
} from './engineRegistry';

describe('engineRegistry', () => {
  it('set/get/delete and shutdownEngines clear engines', () => {
    const fake = { clearTimeout: () => undefined } as any;
    setGameEngine('X', fake);
    expect(getGameEngine('X')).toBe(fake);
    shutdownEngines();
    expect(getGameEngine('X')).toBeUndefined();
  });

  it('shutdownEngines swallows errors from clearTimeout', () => {
    const bad = {
      clearTimeout: () => {
        throw new Error('boom');
      },
    } as any;
    setGameEngine('Y', bad);
    // should not throw
    shutdownEngines();
    expect(getGameEngine('Y')).toBeUndefined();
  });

  it('gameEngines collection helpers behave correctly', () => {
    const e1 = { tag: 'e1' } as unknown as any;
    const e2 = { tag: 'e2' } as unknown as any;
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
