import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { GameBoard, GameState } from './GameBoard';

const noop = () => undefined;

describe('GameBoard', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      'wordbomb:profile:v1',
      JSON.stringify({ id: 'p1', name: 'Alice' }),
    );
  });

  it('renders waiting state when no gameState', () => {
    const { getByText } = render(
      <GameBoard
        gameState={null}
        inputWord=""
        setInputWord={noop}
        handleSubmitWord={noop}
        bombCountdown={0}
        rejected={false}
        liveInputs={{}}
        lastWordAcceptedBy={null}
        lastSubmittedWords={{}}
      />,
    );
    expect(getByText(/Waiting for game to start/i)).toBeTruthy();
  });

  it('renders fragment and players when active', () => {
    const gs: GameState = {
      fragment: 'ab',
      bombDuration: 5,
      currentPlayerId: 'p1',
      players: [
        { id: 'p1', name: 'Alice', isEliminated: false, lives: 2 },
        { id: 'p2', name: 'Bob', isEliminated: false, lives: 2 },
      ],
    };
    const { container } = render(
      <GameBoard
        gameState={gs}
        inputWord="abc"
        setInputWord={noop}
        handleSubmitWord={noop}
        bombCountdown={3}
        rejected={false}
        liveInputs={{ p1: 'abc' }}
        lastWordAcceptedBy={null}
        lastSubmittedWords={{ p2: { word: 'zab', fragment: 'ab' } }}
      />,
    );
    const spans = Array.from(container.querySelectorAll('span'));
    expect(spans.some((n) => n.textContent === 'ab')).toBe(true);
  });

  it('submits word on Enter key', () => {
    const gs: GameState = {
      fragment: 'ab',
      bombDuration: 5,
      currentPlayerId: 'p1',
      players: [
        { id: 'p1', name: 'Alice', isEliminated: false, lives: 2 },
        { id: 'p2', name: 'Bob', isEliminated: false, lives: 2 },
      ],
    };
    const submit = vi.fn();
    const { getByLabelText } = render(
      <GameBoard
        gameState={gs}
        inputWord="abc"
        setInputWord={() => undefined}
        handleSubmitWord={submit}
        bombCountdown={3}
        rejected={false}
        liveInputs={{ p1: 'abc' }}
        lastWordAcceptedBy={null}
        lastSubmittedWords={{}}
      />,
    );
    const input = getByLabelText('Enter a word');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(submit).toHaveBeenCalled();
  });

  it('shows danger overlay when countdown low', () => {
    const gs: GameState = {
      fragment: 'xy',
      bombDuration: 10,
      currentPlayerId: 'p2',
      players: [
        { id: 'p1', name: 'Alice', isEliminated: false, lives: 2 },
        { id: 'p2', name: 'Bob', isEliminated: false, lives: 2 },
      ],
    };
    const { container } = render(
      <GameBoard
        gameState={gs}
        inputWord=""
        setInputWord={() => undefined}
        handleSubmitWord={() => undefined}
        bombCountdown={2}
        rejected={false}
        liveInputs={{}}
        lastWordAcceptedBy={null}
        lastSubmittedWords={{}}
      />,
    );
    // overlay uses animate-pulse-fast; query by that class
    const overlay = container.querySelector('.animate-pulse-fast');
    expect(overlay).toBeTruthy();
  });
});
