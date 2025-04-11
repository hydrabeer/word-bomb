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
  bombCountdown,
  rejected,
  liveInputs,
  lastWordAcceptedBy,
  lastSubmittedWords,
}: GameBoardProps) {
  const localProfileRaw = localStorage.getItem('wordbomb:profile:v1');
  const localPlayerId = localProfileRaw
    ? (JSON.parse(localProfileRaw) as { id: string }).id
    : null;
  const inputRef = useRef<HTMLInputElement>(null);
  const isMyTurn = gameState && localPlayerId === gameState.currentPlayerId;
  const highlightCacheRef = useRef<Record<string, JSX.Element>>({});

  // Timing effects - Fix for the TS18048 error
  const isUrgent = Boolean(
    gameState && bombCountdown && bombCountdown < gameState.bombDuration * 0.3,
  );

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
        <span className="font-bold text-emerald-400">{match}</span>
        {after}
      </>
    );
  }

  const playerViews = useMemo(() => {
    if (!gameState) return [];
    const highlightWithCache = (
      word: string,
      fragment: string,
    ): JSX.Element => {
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
        3: [210, 330, 90],
        4: [225, 315, 45, 135],
      };

      const angleDeg =
        count <= 4 ? predefinedAngles[count][index] : (index / count) * 360;
      const angleRad = (angleDeg * Math.PI) / 180;

      const isMobile = window.innerWidth < 640;
      const radius = isMobile ? 140 : 280;

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
      <div className="flex flex-1 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-indigo-950/50 to-purple-900/50 p-8 text-xl text-white backdrop-blur-sm">
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center shadow-sm backdrop-blur-sm">
          <p className="text-xl leading-relaxed text-indigo-200">
            Waiting for game to start...
          </p>
        </div>
      </div>
    );
  }

  // Calculate bomb countdown percentage for visual indicator
  const countdownPercentage = gameState
    ? Math.min(100, Math.max(0, (bombCountdown / gameState.bombDuration) * 100))
    : 100;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-indigo-950 to-purple-900 text-indigo-100 shadow-lg">
      {/* Game Stats Bar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-black/20 px-4 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-indigo-300">
            Fragment
          </span>
          <span className="text-lg font-bold text-emerald-400">
            {gameState.fragment}
          </span>
        </div>
        <div className="text-center">
          <span className="text-xs uppercase tracking-wider text-indigo-300">
            Time
          </span>
          <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full transition-all duration-100 ease-linear ${
                isUrgent
                  ? 'animate-pulse bg-gradient-to-r from-red-500 to-orange-400'
                  : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
              }`}
              style={{ width: `${countdownPercentage}%` }}
            />
          </div>
        </div>
        <div>
          <span className="text-xs uppercase tracking-wider text-indigo-300">
            Players
          </span>
          <div className="mt-1 flex gap-1">
            {gameState.players.map((p) => (
              <div
                key={p.id}
                className={`h-2 w-2 rounded-full transition-all duration-300 ${
                  p.isEliminated
                    ? 'bg-red-500/50'
                    : p.id === gameState.currentPlayerId
                      ? 'animate-glow bg-emerald-500'
                      : 'bg-indigo-400/50'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bomb Area */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {/* Bomb Pulse Ring - Visual Countdown */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={`absolute h-[120px] w-[120px] rounded-full border-4 transition-all duration-100 sm:h-[180px] sm:w-[180px] ${
              isUrgent
                ? 'border-red-600/50 shadow-lg shadow-red-500/20'
                : 'border-pink-600/30'
            }`}
            style={{
              transform: `scale(${1 + (1 - countdownPercentage / 100) * 0.4})`,
              opacity: 0.1 + (1 - countdownPercentage / 100) * 0.8,
            }}
          />
        </div>

        {/* Danger Zone - shows near timeout */}
        {countdownPercentage < 30 && (
          <div
            className="animate-pulse-fast pointer-events-none absolute inset-0 bg-red-900/10"
            style={{
              opacity: ((30 - countdownPercentage) / 30) * 0.8,
            }}
          />
        )}

        {/* Central Bomb */}
        <div
          className={`sm:h-18 sm:w-18 flex h-16 w-16 items-center justify-center rounded-full backdrop-blur-sm transition-all duration-300 ${
            isUrgent
              ? 'bg-red-950/50 shadow-lg shadow-red-500/20'
              : 'bg-black/40'
          }`}
        >
          <span className="text-center text-2xl font-extrabold uppercase text-white drop-shadow-lg transition-all sm:text-3xl">
            {gameState.fragment}
          </span>
        </div>

        {/* Current Turn Indicator */}
        {gameState?.currentPlayerId && (
          <div className="absolute left-0 right-0 top-0 py-3 text-center text-base font-medium">
            <div
              className={`inline-block rounded-full border border-indigo-700/30 bg-indigo-900/50 px-4 py-1 backdrop-blur-sm transition-all duration-300`}
            >
              <span className="mr-2 text-indigo-300">Turn:</span>
              <span className="font-semibold text-emerald-400">
                {
                  gameState.players.find(
                    (p) => p.id === gameState.currentPlayerId,
                  )?.name
                }
              </span>
            </div>
          </div>
        )}

        {/* Player positions around bomb */}
        <div className="pointer-events-none absolute inset-0">
          {playerViews.map(
            ({ player, isActive, isEliminated, x, y, highlighted }) => (
              <div
                key={player.id}
                className="absolute left-1/2 top-1/2 flex flex-col items-center transition-all duration-300"
                style={{
                  transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
                }}
              >
                {/* Player Platform */}
                <div
                  className={`absolute -inset-3 -z-10 rounded-xl transition-all duration-300 ${
                    isActive
                      ? 'border border-emerald-500/30 bg-emerald-500/10'
                      : isEliminated
                        ? 'border border-red-500/10 bg-red-500/5'
                        : 'bg-indigo-500/5'
                  } backdrop-blur-sm ${isActive ? 'scale-110' : 'scale-100'} ${
                    isActive && isUrgent ? 'animate-pulse' : ''
                  }`}
                />

                {/* Success Flash */}
                {lastWordAcceptedBy === player.id && (
                  <div className="flash-ring bg-emerald-500/30" />
                )}

                {/* Player Name & Lives */}
                <div
                  className={`rounded-full px-3 py-1 transition-all ${
                    isEliminated
                      ? 'line-through opacity-40'
                      : isActive
                        ? 'font-semibold'
                        : ''
                  } ${
                    isActive
                      ? 'border border-emerald-500/30 bg-emerald-950/30 text-emerald-300'
                      : isEliminated
                        ? 'border border-red-500/30 bg-red-950/30 text-red-300'
                        : 'border border-indigo-500/30 bg-indigo-950/30 text-indigo-200'
                  } shadow-lg backdrop-blur-sm`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="whitespace-nowrap text-center text-sm sm:text-base">
                      {player.name}
                    </span>
                    <span className="text-xs">
                      {isEliminated
                        ? '💀'
                        : Array(player.lives)
                            .fill('❤️')
                            .map((heart, i) => (
                              <span
                                key={i}
                                className={`inline-block scale-75 transform ${
                                  isActive && isUrgent ? 'animate-pulse' : ''
                                }`}
                              >
                                {heart}
                              </span>
                            ))}
                    </span>
                  </div>
                </div>

                {/* Word Display */}
                <div
                  className={`mt-2 rounded px-2 py-1 text-center backdrop-blur-sm transition-all ${
                    isActive
                      ? 'border border-white/10 bg-black/20'
                      : 'bg-black/10'
                  }`}
                >
                  <span
                    className={`text-lg font-bold uppercase tracking-wide text-white shadow-sm sm:text-xl ${
                      isActive && gameState.fragment.length > 0
                        ? 'animate-typing'
                        : ''
                    }`}
                  >
                    {highlighted}
                  </span>
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      {/* Input Area */}
      {isMyTurn && (
        <div className="border-t border-white/10 bg-black/20 px-4 py-4 shadow-inner backdrop-blur-sm transition-all duration-300">
          <div className="relative mx-auto flex max-w-xl items-center gap-3">
            <label className="relative block flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputWord}
                onChange={(e) => setInputWord(e.target.value)}
                onKeyDown={onKeyDownHandler}
                placeholder="Type a word..."
                className={`peer w-full rounded-lg border ${
                  rejected
                    ? 'animate-shake border-red-500 bg-red-500/10'
                    : inputWord
                          .toLowerCase()
                          .includes(gameState.fragment.toLowerCase())
                      ? 'border-emerald-500 bg-emerald-900/10'
                      : 'border-indigo-600/30 focus:border-emerald-400'
                } bg-indigo-900/50 px-4 py-3 pt-5 text-base text-white placeholder-transparent transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400`}
              />
              <span className="pointer-events-none absolute left-4 top-2 text-sm text-indigo-300 opacity-0 transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-base peer-placeholder-shown:text-indigo-300 peer-placeholder-shown:opacity-100 peer-focus:top-1 peer-focus:text-xs peer-focus:text-indigo-200 peer-focus:opacity-100">
                Type a word containing &ldquo;{gameState.fragment}&rdquo;...
              </span>
            </label>
            <button
              onClick={handleSubmitWord}
              className={`rounded-lg px-4 py-3 font-medium text-white shadow-lg transition-all ${
                inputWord
                  .toLowerCase()
                  .includes(gameState.fragment.toLowerCase())
                  ? 'bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-500'
                  : 'bg-indigo-600 shadow-indigo-600/20 hover:bg-indigo-500'
              } disabled:opacity-50`}
              disabled={inputWord.length < gameState.fragment.length}
            >
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
