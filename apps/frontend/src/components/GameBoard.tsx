// apps/frontend/src/components/GameBoard.tsx
import { useRef, useEffect, KeyboardEvent, JSX, useMemo } from 'react';
import { PlayerBubble } from './PlayerBubble';

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

  const isMobile = useMemo(() => window.innerWidth < 640, []);

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

      const radius = isMobile ? 140 : 340;

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
  }, [gameState, isMobile, liveInputs, lastSubmittedWords]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const handleFocus = () => {
      setTimeout(() => {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    };

    input.addEventListener('focus', handleFocus);
    return () => input.removeEventListener('focus', handleFocus);
  }, []);

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
      <div className="grid grid-cols-3 items-center justify-between border-b border-white/10 bg-white/5 px-4 py-2 text-center text-sm shadow-inner backdrop-blur-sm">
        <div className="flex flex-col items-start text-left">
          <span className="text-xs uppercase tracking-wider text-indigo-300">
            Fragment
          </span>
          <span className="text-lg font-bold text-emerald-400">
            {gameState.fragment}
          </span>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-xs uppercase tracking-wider text-indigo-300">
            Time
          </span>
          <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
            <div
              key={gameState.currentPlayerId}
              className={`h-[100dvh] origin-left ${
                isUrgent
                  ? 'bg-gradient-to-r from-red-500 to-orange-400'
                  : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
              } animate-bomb-progress`}
              style={{ animationDuration: `${gameState.bombDuration}s` }}
            />
          </div>
        </div>

        <div className="flex flex-col items-end text-right">
          <span className="text-xs uppercase tracking-wider text-indigo-300">
            Players
          </span>
          <div className="mt-1 flex gap-1">
            {gameState.players.map((p) => (
              <div
                key={p.id}
                className={`h-2 w-2 rounded-full transition-transform duration-300 ${
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
            className={`absolute h-[120px] w-[120px] rounded-full border-4 transition-transform duration-100 sm:h-[180px] sm:w-[180px] ${
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
          className={`sm:h-18 sm:w-18 flex h-16 w-16 items-center justify-center rounded-full backdrop-blur-sm transition-transform duration-300 ${
            isUrgent
              ? 'bg-red-950/50 shadow-lg shadow-red-500/20'
              : 'bg-black/40'
          }`}
        >
          <span className="text-center text-2xl font-extrabold uppercase text-white drop-shadow-lg sm:text-3xl">
            {gameState.fragment}
          </span>
        </div>

        {/* Player positions around bomb */}
        <div className="pointer-events-none absolute inset-0">
          {playerViews.map((view) => (
            <PlayerBubble
              key={view.player.id}
              {...view}
              lastWordAcceptedBy={lastWordAcceptedBy}
              isUrgent={isUrgent}
            />
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className={`border-t border-white/10 bg-black/20 px-4 py-4 shadow-inner backdrop-blur-sm transition-transform duration-300 ${
          isMobile ? 'fixed bottom-0 left-0 z-30 w-full' : ''
        }`}
      >
        <div className="relative mx-auto flex max-w-xl items-center justify-center gap-3">
          {isMyTurn ? (
            <>
              <label className="relative block flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputWord}
                  onChange={(e) => setInputWord(e.target.value)}
                  onKeyDown={onKeyDownHandler}
                  placeholder="Type a word..."
                  inputMode="text"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  enterKeyHint="done"
                  className={`peer w-full rounded-lg border ${
                    rejected
                      ? 'animate-shake border-red-500 bg-red-500/10'
                      : inputWord
                            .toLowerCase()
                            .includes(gameState.fragment.toLowerCase())
                        ? 'border-emerald-500 bg-emerald-900/10'
                        : 'border-indigo-600/30 focus:border-emerald-400'
                  } bg-indigo-900/50 px-4 py-3 pt-5 text-base text-white placeholder-transparent transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400`}
                  style={{
                    fontSize: '16px', // prevents zoom on iOS Safari
                  }}
                />
                <span className="pointer-events-none absolute left-4 top-2 text-sm text-indigo-300 opacity-0 transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-base peer-placeholder-shown:text-indigo-300 peer-placeholder-shown:opacity-100 peer-focus:top-1 peer-focus:text-xs peer-focus:text-indigo-200 peer-focus:opacity-100">
                  Type a word containing &ldquo;{gameState.fragment}&rdquo;...
                </span>
              </label>
              {!isMobile && (
                <button
                  onClick={handleSubmitWord}
                  className={`rounded-lg px-4 py-3 font-medium text-white shadow-lg transition-transform ${
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
              )}
            </>
          ) : (
            <div className="flex w-full items-center justify-center rounded-lg border border-indigo-700/30 bg-indigo-900/50 px-4 py-3 text-center text-base font-medium text-indigo-200 backdrop-blur-sm">
              <span className="mr-2 text-indigo-300">Waiting for:</span>
              <span className="font-semibold text-emerald-400">
                {
                  gameState.players.find(
                    (p) => p.id === gameState.currentPlayerId,
                  )?.name
                }
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
