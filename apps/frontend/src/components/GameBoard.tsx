// apps/frontend/src/components/GameBoard.tsx
import { useRef, useEffect, KeyboardEvent, JSX, useMemo } from 'react';

export interface GameState {
  fragment: string;
  bombDuration: number;
  currentPlayerId: string | null;
  players: {
    id: string;
    name: string;
    isEliminated: boolean;
    lives: number;
  }[];
}

export interface GameBoardProps {
  gameState: GameState | null;
  inputWord: string;
  setInputWord: (word: string) => void;
  handleSubmitWord: () => void;
  bombCountdown: number;
  rejected: boolean;
  liveInputs: Record<string, string>;
  lastWordAcceptedBy: string | null;
  lastSubmittedWords: Record<string, { word: string; fragment: string }>;
}

export function GameBoard({
  gameState,
  inputWord,
  setInputWord,
  handleSubmitWord,
  rejected,
  liveInputs,
  lastWordAcceptedBy,
  lastSubmittedWords,
}: GameBoardProps) {
  const localProfileRaw = localStorage.getItem('wordbomb:profile:v1');
  const localPlayerId = localProfileRaw ? (JSON.parse(localProfileRaw) as { id: string }).id : null;
  const inputRef = useRef<HTMLInputElement>(null);
  const isMyTurn = gameState && localPlayerId === gameState.currentPlayerId;
  const highlightCacheRef = useRef<Record<string, JSX.Element>>({});

  useEffect(() => {
    if (!isMyTurn) return;
    const focusInput = () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    focusInput();
    const timeout = setTimeout(focusInput, 50);
    return () => clearTimeout(timeout);
  }, [isMyTurn]);

  const onKeyDownHandler = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmitWord();
    }
  };

  function highlightFragment(word: string, fragment: string): JSX.Element {
    const lowerWord = word.toLowerCase();
    const lowerFragment = fragment.toLowerCase();
    const index = lowerWord.indexOf(lowerFragment);

    if (index === -1) {
      return <>{word}</>;
    }

    const before = word.slice(0, index);
    const match = word.slice(index, index + fragment.length);
    const after = word.slice(index + fragment.length);

    return (
      <>
        {before}
        <span className="text-green-400">{match}</span>
        {after}
      </>
    );
  }

  const playerViews = useMemo(() => {
    if (!gameState) return [];
    const highlightWithCache = (word: string, fragment: string): JSX.Element => {
      const key = `${word.toLowerCase()}::${fragment.toLowerCase()}`;
      const cached = highlightCacheRef.current[key];
      if (cached) return cached;

      const result = highlightFragment(word, fragment);
      highlightCacheRef.current[key] = result;
      return result;
    };

    const count = gameState.players.length;

    return gameState.players.map((player, index) => {
      const predefinedAngles: Record<number, number[]> = {
        2: [180, 0],
        3: [270, 30, 150],
        4: [270, 0, 90, 180],
      };

      const angleDeg = count <= 4 ? predefinedAngles[count][index] : (index / count) * 360;
      const angleRad = (angleDeg * Math.PI) / 180;

      const isMobile = window.innerWidth < 640;
      const radius = isMobile ? 125 : 300;

      const x = Math.cos(angleRad) * radius;
      const y = Math.sin(angleRad) * radius;

      const isEliminated = player.lives <= 0;
      const isActive = gameState.currentPlayerId === player.id;
      const currentInput = liveInputs[player.id] ?? '';
      const last = lastSubmittedWords[player.id];

      const highlightedInput =
        isActive && currentInput
          ? currentInput.length >= gameState.fragment.length
            ? highlightWithCache(currentInput, gameState.fragment)
            : currentInput
          : null;

      const highlightedLastWord =
        !isActive && last ? highlightWithCache(last.word, last.fragment) : null;

      return {
        player,
        isActive,
        isEliminated,
        x,
        y,
        highlighted: highlightedInput ?? highlightedLastWord,
      };
    });
  }, [gameState, liveInputs, lastSubmittedWords]);

  if (!gameState) {
    return (
      <div className="flex flex-1 items-center justify-center text-xl text-white">
        Waiting for game to start...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-900 text-gray-100">
      {/* Bomb + Fragment */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <div className="relative z-10 flex scale-[1.2] items-center justify-center sm:scale-[1.8]">
          <div className="animate-bomb-pulse text-8xl sm:text-9xl">💣</div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="-translate-x-2 translate-y-5 text-center text-2xl font-bold uppercase tracking-wide text-white drop-shadow-md sm:text-4xl md:translate-y-6">
              {gameState.fragment}
            </span>
          </div>
        </div>

        {/* Player positions around bomb */}
        <div className="pointer-events-none absolute inset-0">
          {playerViews.map(({ player, isActive, isEliminated, x, y, highlighted }) => (
            <div
              key={player.id}
              className="absolute left-1/2 top-1/2 flex flex-col items-center transition-transform duration-300"
              style={{
                transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
              }}
            >
              {lastWordAcceptedBy === player.id && <div className="flash-ring" />}
              <div
                className={`text-center text-sm sm:text-base ${
                  isEliminated
                    ? 'line-through opacity-40'
                    : isActive
                      ? 'font-semibold text-indigo-400'
                      : 'text-white/80'
                }`}
              >
                {player.name} {isEliminated ? '💀' : '❤️'.repeat(player.lives)}
              </div>

              <div className="mt-1 text-xl font-bold uppercase tracking-wide text-white sm:text-2xl">
                {highlighted}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Current Turn Display */}

      {gameState?.currentPlayerId && (
        <div className="mb-3 text-center text-base font-medium text-indigo-400 sm:text-lg">
          Turn: {gameState.players.find((p) => p.id === gameState.currentPlayerId)?.name}
        </div>
      )}

      {/* Input */}
      {isMyTurn && (
        <div className="border-t border-gray-700 bg-gray-800 px-4 py-4">
          <label className="relative mx-auto block max-w-xl">
            <input
              ref={inputRef}
              type="text"
              value={inputWord}
              onChange={(e) => setInputWord(e.target.value)}
              onKeyDown={onKeyDownHandler}
              placeholder="Type a word..."
              className={`peer w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-2 pt-4 text-sm text-white placeholder-transparent transition focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 sm:text-base ${
                rejected ? 'animate-shake border-red-500' : ''
              }`}
            />
            <span className="pointer-events-none absolute left-4 top-2.5 text-sm text-gray-400 opacity-0 transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400 peer-placeholder-shown:opacity-100 peer-focus:top-0.5 peer-focus:text-xs peer-focus:text-indigo-400 peer-focus:opacity-100">
              Type a word...
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
