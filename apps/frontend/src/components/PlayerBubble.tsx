// apps/frontend/src/components/PlayerBubble.tsx
import { JSX, memo } from 'react';
import { GameState } from './GameBoard.tsx';

function PlayerBubbleComponent({
  player,
  isActive,
  isEliminated,
  x,
  y,
  highlighted,
  isUrgent,
  flash,
  shake,
  rotation = 0,
}: {
  player: GameState['players'][number];
  isActive: boolean;
  isEliminated: boolean;
  x: number;
  y: number;
  highlighted: string | JSX.Element | null;
  isUrgent: boolean;
  flash: boolean; // triggers green acceptance flash
  shake: boolean; // triggers rejection shake animation
  rotation?: number;
}) {
  return (
    <div
      className="absolute left-1/2 top-1/2 transition-transform duration-500 ease-in-out"
      style={{
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rotation}deg)`,
        width: 0,
        height: 0,
      }}
    >
      {/* Centered acceptance flash ring (100x100). Root has zero size; we offset by half dimensions. */}
      {flash && (
        <div
          className="flash-ring bg-emerald-400/70"
          style={{ position: 'absolute', left: 0, top: 0, marginLeft: -50, marginTop: -50 }}
        />
      )}
      {/* Hearts + Name (independent fixed stack) */}
      <div
        className="absolute flex flex-col items-center"
        style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%) translateY(-12px)' }}
      >
        <div className="flex items-center justify-center gap-1 mb-1 h-6 sm:h-7 w-max">
          {isEliminated ? (
            <span className="text-xl leading-none">💀</span>
          ) : (
            Array(player.lives)
              .fill('❤️')
              .map((heart, i) => (
                <span
                  key={i}
                  className={`inline-block text-lg sm:text-xl leading-none ${
                    isActive && isUrgent ? 'animate-pulse' : ''
                  }`}
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }}
                >
                  {heart}
                </span>
              ))
          )}
        </div>
        <div
          className={`flex items-center justify-center font-semibold tracking-wide leading-tight h-5 sm:h-6 w-max ${
            isEliminated
              ? 'line-through opacity-40 text-red-300'
              : isActive
                ? 'text-emerald-300'
                : 'text-indigo-200'
          } drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]`}
        >
          <span
            className="whitespace-nowrap text-sm sm:text-base md:text-lg"
            title={player.name}
          >
            {player.name}
          </span>
        </div>
      </div>
      {/* Word (separate absolutely centered) */}
      <div
        className="absolute flex items-center justify-center"
        style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%) translateY(28px)' }}
      >
        <span
          className={`whitespace-nowrap text-lg sm:text-xl md:text-2xl font-bold uppercase tracking-wide text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] ${
            isActive && highlighted ? 'animate-typing' : ''
          } ${isEliminated ? 'opacity-30' : ''} ${shake ? 'animate-shake text-red-300' : ''}`}
          style={{ visibility: highlighted ? 'visible' : 'hidden' }}
        >
          {highlighted ?? '\u200B'}
        </span>
      </div>
    </div>
  );
}

PlayerBubbleComponent.displayName = 'PlayerBubble';

export const PlayerBubble = memo(PlayerBubbleComponent);
