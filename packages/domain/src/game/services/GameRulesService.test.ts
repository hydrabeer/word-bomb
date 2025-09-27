import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Game } from '../Game';
import { Player } from '../../players/Player';
import { BonusProgress } from '../BonusProgress';
import type { GameRoomRules } from '../../rooms/GameRoomRules';
import {
  GameRulesService,
  type WordValidator,
  type FragmentProvider,
} from './GameRulesService';

const mockBonusTemplate = new Array(26).fill(1) as number[];

const makePlayer = (name: string, eliminated = false): Player =>
  new Player({
    id: name.toLowerCase(),
    name,
    isLeader: false,
    isSeated: true,
    isEliminated: eliminated,
    isConnected: true,
    lives: 3,
    bonusProgress: new BonusProgress(mockBonusTemplate),
  });

const rules: GameRoomRules = {
  maxLives: 3,
  startingLives: 3,
  bonusTemplate: mockBonusTemplate,
  minTurnDuration: 5,
  minWordsPerPrompt: 2,
};

describe('GameRulesService', () => {
  let game: Game;
  let svc: GameRulesService;
  let validator: WordValidator;
  let fragments: FragmentProvider;

  let alice: Player;
  let bob: Player;

  beforeEach(() => {
    alice = makePlayer('Alice');
    bob = makePlayer('Bob');

    game = new Game({
      roomCode: 'ROOM',
      players: [alice, bob],
      currentTurnIndex: 0,
      fragment: 'ing',
      state: 'active',
      rules,
    });

    validator = { isValid: () => true };
    fragments = { nextFragment: () => 'xy' };

    svc = new GameRulesService(game, validator, fragments);
  });

  it('getCurrentPlayer proxies to game.getCurrentPlayer', () => {
    expect(svc.getCurrentPlayer().id).toBe(game.getCurrentPlayer().id);
  });

  describe('validateSubmission', () => {
    it('fails if not your turn', () => {
      const res = svc.validateSubmission(bob.id, 'sing');
      expect(res).toBe('Not your turn.');
    });

    it('fails if too short (after trim)', () => {
      const res = svc.validateSubmission(alice.id, ' a ');
      expect(res).toBe('Invalid word (too short).');
    });

    it("fails if word doesn't contain fragment (case-insensitive)", () => {
      const res = svc.validateSubmission(alice.id, 'hello');
      expect(res).toBe("Word doesn't contain the fragment.");
    });

    it('fails if word was already used this game', () => {
      const word = 'singing';
      game.markWordUsed(word);
      const res = svc.validateSubmission(alice.id, word);
      expect(res).toBe('Word already used this game.');
    });

    it('fails if validator rejects', () => {
      validator = { isValid: () => false };
      svc = new GameRulesService(game, validator, fragments);
      const res = svc.validateSubmission(alice.id, 'singing');
      expect(res).toBe('Not a valid word.');
    });

    it('returns null on success', () => {
      // fragment is "ing"; this word includes it and is valid by default
      const res = svc.validateSubmission(alice.id, 'singing');
      expect(res).toBeNull();
    });
  });

  it('applyAcceptedWord marks used, applies bonus letters, and adjusts bomb timer', () => {
    const word = 'cab';
    const spyMark = vi.spyOn(game, 'markWordUsed');
    const spyAdjust = vi.spyOn(game, 'adjustBombTimerAfterValidWord');
    const tryBonusSpy = vi.spyOn(alice, 'tryBonusLetter');

    svc.applyAcceptedWord(alice, word);

    expect(spyMark).toHaveBeenCalledWith(word);
    expect(game.hasWordBeenUsed(word)).toBe(true);
    expect(tryBonusSpy).toHaveBeenCalledTimes(word.length);
    expect(tryBonusSpy).toHaveBeenNthCalledWith(
      1,
      'c',
      rules.maxLives,
      rules.bonusTemplate,
    );
    expect(tryBonusSpy).toHaveBeenNthCalledWith(
      2,
      'a',
      rules.maxLives,
      rules.bonusTemplate,
    );
    expect(tryBonusSpy).toHaveBeenNthCalledWith(
      3,
      'b',
      rules.maxLives,
      rules.bonusTemplate,
    );
    expect(spyAdjust).toHaveBeenCalledOnce();
  });

  it('advanceTurn moves to next player and sets next fragment from provider', () => {
    const nextFragmentSpy = vi.spyOn(fragments, 'nextFragment');
    const nextTurnSpy = vi.spyOn(game, 'nextTurn');
    const setFragmentSpy = vi.spyOn(game, 'setFragment');

    svc.advanceTurn();

    expect(nextTurnSpy).toHaveBeenCalledOnce();
    expect(nextFragmentSpy).toHaveBeenCalledWith(rules.minWordsPerPrompt);
    expect(setFragmentSpy).toHaveBeenCalledWith('xy');
    expect(game.fragment).toBe('xy');
  });

  describe('checkGameOver', () => {
    it('returns ended: false when 2+ players remain', () => {
      const res = svc.checkGameOver();
      expect(res).toEqual({ ended: false });
    });

    it('returns winner when only one player remains', () => {
      bob.isEliminated = true;
      const res = svc.checkGameOver();
      expect(res.ended).toBe(true);
      expect(res.winnerId).toBe(alice.id);
    });

    it('returns ended with no winner when no players remain', () => {
      alice.isEliminated = true;
      bob.isEliminated = true;
      const res = svc.checkGameOver();
      expect(res).toEqual({ ended: true, winnerId: undefined });
    });
  });
});
