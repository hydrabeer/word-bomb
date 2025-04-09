// apps/frontend/src/components/GameBoard.tsx
import { KeyboardEvent } from "react";

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
  const localProfileRaw = localStorage.getItem("wordbomb:profile:v1");
  const localPlayerId = localProfileRaw ? JSON.parse(localProfileRaw).id : null;

  // Handler for key press event; if Enter is pressed, submit the word.
  const onKeyDownHandler = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmitWord();
    }
  };

  return (
    <div
      className="flex flex-col h-full overflow-hidden text-white bg-gradient-to-br from-[#12111A] to-[#0D0C13]">
      {/* Game Display */}
      <div
        className="flex-1 relative flex items-center justify-center px-4 py-8">
        {gameState ? (
          <>
            {/* Bomb Fragment & Turn Info */}
            <div
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
              <div
                className="text-6xl sm:text-7xl font-extrabold drop-shadow-lg">
                {gameState.fragment}
              </div>
              {gameState.currentPlayerId && (
                <div
                  className="mt-3 text-lg sm:text-2xl text-purple-300 font-medium">
                  Turn: {gameState.players.find((p) => p.id === gameState.currentPlayerId)?.name}
                </div>
              )}
            </div>

            {/* Player Ring */}
            <div
              className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-4 p-6 pointer-events-none">
              {gameState.players.map((player) => (
                <div
                  key={player.id}
                  className={`text-center text-sm sm:text-base font-medium ${
                    player.lives <= 0 ? "opacity-40 line-through" : "text-white"
                  }`}
                >
                  {player.name} {player.lives > 0 ? `❤️ ${player.lives}` : "💀"}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-2xl text-center">Waiting for game to
            start...</div>
        )}
      </div>

      {/* Word Input (only for current player) */}
      {gameState && localPlayerId === gameState.currentPlayerId && (
        <div
          className="bg-[#1E1B2E] border-t border-purple-800/40 shadow-inner shadow-purple-900/10 px-4 py-4">
          <label className="relative block max-w-xl mx-auto">
            <input
              type="text"
              value={inputWord}
              onChange={(e) => setInputWord(e.target.value)}
              onKeyDown={onKeyDownHandler}
              placeholder="Type a word..."
              className={`
            w-full peer
            px-4 py-2
            pt-4 peer-placeholder-shown:pt-2
            rounded-lg
            text-sm sm:text-base
            bg-[#202435]
            border border-gray-600
            placeholder-transparent
            text-white
            focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400
            transition-all duration-200 ease-in-out
          `}
            />
            <span
              className={`
            absolute left-4 text-sm text-gray-400
            top-2.5 peer-placeholder-shown:top-3
            peer-focus:top-0.5 peer-focus:text-xs peer-focus:text-blue-400
            transition-all duration-200 ease-in-out
            pointer-events-none
          `}
            >
          Type a word...
        </span>
          </label>
        </div>
      )}
    </div>

  );
}
