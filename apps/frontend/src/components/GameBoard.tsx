// apps/frontend/src/components/GameBoard.tsx
import {
  useRef,
  useEffect,
  type KeyboardEvent,
  type JSX,
  useMemo,
  useState,
} from 'react';
import { PlayerBubble } from './PlayerBubble';
import { BonusAlphabet } from './BonusAlphabet';
import { useBonusAlphabetSettings } from '../hooks/useBonusAlphabetSettings';
import type { BonusAlphabetSettings } from '../hooks/useBonusAlphabetSettings';

export interface GameState {
  fragment: string;
  bombDuration: number;
  currentPlayerId: string | null;
  players: {
    id: string;
    name: string;
    isEliminated: boolean;
    lives: number;
    isConnected?: boolean;
    bonusProgress?: { remaining: number[]; total: number[] };
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
  const { settings: bonusSettings } = useBonusAlphabetSettings();
  const localPlayerId = useMemo(() => {
    try {
      return (
        JSON.parse(localStorage.getItem('wordbomb:profile:v1') ?? 'null') as {
          id: string;
        } | null
      )?.id;
    } catch {
      return null;
    }
  }, []);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMyTurn = gameState && localPlayerId === gameState.currentPlayerId;
  // Removed highlight cache (cheap to compute, saves lines / complexity)

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
    // Removed highlight cache (cheap to compute, saves lines / complexity)
    const timeout = setTimeout(focusInput, 50);
    return () => {
      clearTimeout(timeout);
    };
  }, [isMyTurn]);

  const onKeyDownHandler = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmitWord();
    }
  };

  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640;
  }, []); // Could be swapped to useIsMobile(640) if desired
  const computedBonusAlphabetSettings = useMemo<BonusAlphabetSettings>(
    () =>
      isMobile
        ? ({
            ...bonusSettings,
            size: 'sm',
            position: 'bottom-left',
            opacity: 0.9,
            showNumbers: false,
            layout: 'rows',
          } as BonusAlphabetSettings)
        : bonusSettings,
    [bonusSettings, isMobile],
  );
  const arenaRef = useRef<HTMLDivElement>(null);
  const [arenaSize, setArenaSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = arenaRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      const [entry] = entries;
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setArenaSize({ width, height });
    });

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  const mobileRadius = useMemo(() => {
    if (!isMobile) return 0;
    const minDimension = Math.min(arenaSize.width, arenaSize.height);
    if (!minDimension) return 150;
    const padded = Math.max(minDimension - 64, 0);
    return Math.min(Math.max(padded / 2, 150), 260);
  }, [arenaSize.height, arenaSize.width, isMobile]);
  interface PlayerView {
    player: GameState['players'][number];
    isActive: boolean;
    isEliminated: boolean;
    x: number;
    y: number;
    highlighted: JSX.Element | string | null;
  }
  const radius = useMemo(
    () => (isMobile ? mobileRadius || 150 : 340),
    [isMobile, mobileRadius],
  );

  const bombScale = useMemo(() => {
    if (!isMobile) return 1;
    return Math.min(Math.max(radius / 160, 0.95), 1.3);
  }, [isMobile, radius]);

  const { rotationOffset, playerViews } = useMemo<{
    rotationOffset: number;
    playerViews: PlayerView[];
  }>(() => {
    if (!gameState) return { rotationOffset: 0, playerViews: [] };
    const count = gameState.players.length;
    const rotationOffset = 0;
    const predefined: Record<number, number[]> = {
      2: [180, 0],
      3: [210, 330, 90],
      4: [225, 315, 45, 135],
    };
    const highlight = (word: string, fragment: string): JSX.Element => {
      const lw = word.toLowerCase();
      const lf = fragment.toLowerCase();
      const i = lw.indexOf(lf);
      if (i < 0) return <>{word}</>;
      return (
        <>
          {word.slice(0, i)}
          <span className="font-bold text-emerald-400">
            {word.slice(i, i + fragment.length)}
          </span>
          {word.slice(i + fragment.length)}
        </>
      );
    };
    const pv: PlayerView[] = gameState.players.map((player, index) => {
      const angleDeg =
        count <= 4 ? predefined[count][index] : (index / count) * 360;
      const rad = (angleDeg * Math.PI) / 180;
      const x = Math.cos(rad) * radius;
      const y = Math.sin(rad) * radius;
      const isActive = gameState.currentPlayerId === player.id;
      const currentInput = liveInputs[player.id] ?? '';
      const last = lastSubmittedWords[player.id];
      const showInput =
        isActive &&
        currentInput &&
        currentInput.length >= gameState.fragment.length
          ? highlight(currentInput, gameState.fragment)
          : isActive
            ? currentInput
            : null;
      const showLast =
        !isActive && last ? highlight(last.word, last.fragment) : null;
      return {
        player,
        isActive,
        isEliminated: player.lives <= 0,
        x,
        y,
        highlighted: showInput ?? showLast,
      };
    });
    return { rotationOffset, playerViews: pv };
  }, [gameState, liveInputs, lastSubmittedWords, radius]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const handleFocus = () => {
      setTimeout(() => {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    };

    input.addEventListener('focus', handleFocus);
    return () => {
      input.removeEventListener('focus', handleFocus);
    };
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
  const countdownPercentage = Math.min(
    100,
    Math.max(0, (bombCountdown / gameState.bombDuration) * 100),
  );

  // Red reactive ring parameters (single color theme)
  const progressRemaining = countdownPercentage / 100; // 1 -> full time, 0 -> expired
  const progressElapsed = 1 - progressRemaining;
  // Single-ring visual: opacity pulse tied directly to elapsed progress (one pulse over the turn)
  const pulsePhase = Math.sin(progressElapsed * Math.PI); // 0 -> 1 -> 0 over the turn
  const ringStrokeOpacity = 0.7 + pulsePhase * 0.25; // 0.7 - 0.95 peak mid-turn
  const ringGlowOpacity = 0.35 + pulsePhase * 0.4; // for outer glow wrapper
  const circumference = 2 * Math.PI * 45; // r=45 for SVG circle
  const strokeDashoffset = progressElapsed * circumference;

  return (
    <div className="flex w-full flex-1 flex-col overflow-hidden bg-gradient-to-br from-indigo-950 to-purple-900 text-indigo-100 sm:rounded-xl sm:border sm:border-white/10 sm:shadow-lg">
      {/* Game Stats Bar */}
      <div className="hidden grid-cols-3 items-center justify-between border-b border-white/10 bg-white/5 px-4 py-2 text-center text-sm shadow-inner backdrop-blur-sm sm:grid">
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
          <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full origin-left bg-gradient-to-r from-red-500 via-red-400 to-red-500"
              style={{
                width: `${String(countdownPercentage)}%`,
                transition: 'width 0.15s linear',
              }}
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
      <div
        ref={arenaRef}
        className="relative flex flex-1 items-center justify-center overflow-hidden"
      >
        {/* floating bonus alphabet overlay for the local player (anchored to play area) */}
        {!isMobile && (
          <BonusAlphabet
            progress={
              gameState.players.find((p) => p.id === localPlayerId)
                ?.bonusProgress ?? null
            }
            settings={computedBonusAlphabetSettings}
          />
        )}
        {/* Red Reactive Bomb Ring */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative flex items-center justify-center">
            <div
              className="bomb-arc-glow-wrapper"
              style={{
                opacity: ringGlowOpacity,
                // Breathing scale (slight) synced exactly with pulsePhase
                transform: `scale(${String(bombScale * (1 + pulsePhase * 0.035))})`,
                transition: 'transform 0.15s linear, opacity 0.15s linear',
                filter: `drop-shadow(0 0 ${String(8 + pulsePhase * 6)}px rgba(239,68,68,${String(0.45 + pulsePhase * 0.35)})) drop-shadow(0 0 ${String(18 + pulsePhase * 10)}px rgba(239,68,68,${String(0.25 + pulsePhase * 0.25)}))`,
              }}
            >
              <svg
                className="relative h-[146px] w-[146px] sm:h-[206px] sm:w-[206px]"
                viewBox="0 0 100 100"
                role="presentation"
              >
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  stroke="#ef4444"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeOpacity={ringStrokeOpacity}
                  style={{
                    strokeDasharray: circumference,
                    strokeDashoffset,
                    transition:
                      'stroke-dashoffset 0.15s linear, stroke-opacity 0.2s linear',
                    transform: 'rotate(-90deg)',
                    transformOrigin: '50% 50%',
                  }}
                />
              </svg>
            </div>
          </div>
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
          style={{ transform: `scale(${String(bombScale)})` }}
        >
          <span className="text-center text-2xl font-extrabold uppercase text-white drop-shadow-lg sm:text-3xl">
            {gameState.fragment}
          </span>
        </div>

        {/* Player positions around bomb */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className={`relative`}
            style={{
              transform:
                isMobile && rotationOffset !== 0
                  ? `rotate(${String(rotationOffset)}deg)`
                  : undefined,
              transition: 'transform 0.4s ease-in-out',
            }}
          >
            {playerViews.map((view) => (
              <PlayerBubble
                key={view.player.id}
                {...view}
                isUrgent={isUrgent}
                flash={lastWordAcceptedBy === view.player.id}
                shake={
                  rejected &&
                  gameState.currentPlayerId === view.player.id &&
                  !!view.highlighted
                }
                rotation={-rotationOffset} // So contents stay upright
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar (fixed height for consistency across states) */}
      <div
        className={`border-t border-white/10 bg-black/30 shadow-inner backdrop-blur-sm transition-all duration-300 ${
          isMobile
            ? 'sticky bottom-0 left-0 z-30 w-full px-4 pb-4 pt-3'
            : 'flex h-20 items-center px-4'
        }`}
        style={
          isMobile
            ? { paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }
            : undefined
        }
      >
        <div
          className={`mx-auto w-full max-w-2xl ${
            isMobile ? 'flex flex-col gap-3' : 'flex h-14 items-center gap-4'
          }`}
        >
          {isMobile && (
            <BonusAlphabet
              progress={
                gameState.players.find((p) => p.id === localPlayerId)
                  ?.bonusProgress ?? null
              }
              settings={computedBonusAlphabetSettings}
            />
          )}
          <div className="relative flex h-14 w-full items-center gap-4">
            {isMyTurn ? (
              <div
                className={`flex h-full w-full items-center justify-center rounded-lg px-4 backdrop-blur-sm transition-colors ${
                  rejected
                    ? 'animate-shake border border-red-500 bg-red-500/10'
                    : inputWord
                          .toLowerCase()
                          .includes(gameState.fragment.toLowerCase())
                      ? 'border border-emerald-500 bg-emerald-900/10'
                      : 'border border-indigo-700/30 bg-indigo-900/50'
                }`}
              >
                <label htmlFor="play-input" className="sr-only">
                  Enter a word
                </label>
                <input
                  id="play-input"
                  ref={inputRef}
                  type="text"
                  value={inputWord}
                  maxLength={30}
                  onChange={(e) => {
                    const v = e.target.value.slice(0, 30);
                    setInputWord(v);
                  }}
                  onKeyDown={onKeyDownHandler}
                  placeholder={`Type a word containing "${gameState.fragment}"...`}
                  inputMode="text"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  enterKeyHint="done"
                  className="h-full w-full bg-transparent text-center text-base text-white placeholder:text-indigo-300 focus:outline-none"
                  style={{ fontSize: '16px' }}
                />
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-lg border border-indigo-700/30 bg-indigo-900/50 px-4 text-center text-base font-medium text-indigo-200 backdrop-blur-sm">
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
    </div>
  );
}
