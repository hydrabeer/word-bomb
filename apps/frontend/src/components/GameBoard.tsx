// apps/frontend/src/components/GameBoard.tsx
import { KeyboardEvent } from 'react';

export interface GameState {
  fragment: string;
  bombDuration: number;
  currentPlayerId: string | null;
  players: Array<{
    id: string;
    name: string;
    isEliminated: boolean;
    lives: number;
  }>;
}

export interface GameBoardProps {
  gameState: GameState | null;
  inputWord: string;
  setInputWord: (word: string) => void;
  handleSubmitWord: () => void;
}

export function GameBoard({
  gameState,
  inputWord,
  setInputWord,
  handleSubmitWord,
}: GameBoardProps) {
  const localProfileRaw = localStorage.getItem('wordbomb:profile:v1');
  const localPlayerId = localProfileRaw ? JSON.parse(localProfileRaw).id : null;

  // Handler for key press event; if Enter is pressed, submit the word.
  const onKeyDownHandler = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmitWord();
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gradient-to-br from-[#12111A] to-[#0D0C13] text-white">
      {/* Game Display */}
      <div className="relative flex flex-1 items-center justify-center px-4 py-8">
        {gameState ? (
          <>
            {/* Bomb Fragment & Turn Info */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform text-center">
              <div className="text-6xl font-extrabold drop-shadow-lg sm:text-7xl">
                {gameState.fragment}
              </div>
              {gameState.currentPlayerId && (
                <div className="mt-3 text-lg font-medium text-purple-300 sm:text-2xl">
                  Turn: {gameState.players.find((p) => p.id === gameState.currentPlayerId)?.name}
                </div>
              )}
            </div>

            {/* Player Ring */}
            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 gap-4 p-6">
              {gameState.players.map((player) => (
                <div
                  key={player.id}
                  className={`text-center text-sm font-medium sm:text-base ${
                    player.lives <= 0 ? 'line-through opacity-40' : 'text-white'
                  }`}
                >
                  {player.name} {player.lives > 0 ? `❤️ ${player.lives}` : '💀'}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center text-2xl">Waiting for game to start...</div>
        )}
      </div>

      {/* Word Input (only for current player) */}
      {gameState && localPlayerId === gameState.currentPlayerId && (
        <div className="border-t border-purple-800/40 bg-[#1E1B2E] px-4 py-4 shadow-inner shadow-purple-900/10">
          <label className="relative mx-auto block max-w-xl">
            <input
              type="text"
              value={inputWord}
              onChange={(e) => setInputWord(e.target.value)}
              onKeyDown={onKeyDownHandler}
              placeholder="Type a word..."
              className={`peer w-full rounded-lg border border-gray-600 bg-[#202435] px-4 py-2 pt-4 text-sm text-white placeholder-transparent transition-all duration-200 ease-in-out focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 peer-placeholder-shown:pt-2 sm:text-base`}
            />
            <span
              className={`pointer-events-none absolute left-4 top-2.5 text-sm text-gray-400 transition-all duration-200 ease-in-out peer-placeholder-shown:top-3 peer-focus:top-0.5 peer-focus:text-xs peer-focus:text-blue-400`}
            >
              Type a word...
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
