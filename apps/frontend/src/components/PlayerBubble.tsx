// apps/frontend/src/components/PlayerBubble.tsx
import { type JSX, memo } from 'react';
import { type GameState } from './GameBoard.tsx';

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
        transform: `translate(-50%, -50%) translate(${String(x)}px, ${String(y)}px) rotate(${String(rotation)}deg)`,
        width: 0,
        height: 0,
      }}
    >
      {/* Centered acceptance flash ring (100x100). Root has zero size; we offset by half dimensions. */}
      {flash && (
        <div
          className="flash-ring bg-emerald-400/70"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            marginLeft: -50,
            marginTop: -50,
          }}
        />
      )}
      {/* Hearts + Name (independent fixed stack) */}
      <div
        className="absolute flex flex-col items-center"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%) translateY(-12px)',
        }}
      >
        <div className="mb-1 flex h-6 w-max items-center justify-center gap-1 sm:h-7">
          {isEliminated ? (
            <span className="text-xl leading-none">💀</span>
          ) : (
            Array(player.lives)
              .fill('❤️')
              .map((heart, i) => (
                <span
                  key={i}
                  className={`inline-block text-lg leading-none sm:text-xl ${
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
          className={`flex h-5 w-max items-center justify-center font-semibold leading-tight tracking-wide sm:h-6 ${
            isEliminated
              ? 'text-red-300 line-through opacity-40'
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
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%) translateY(28px)',
        }}
      >
        <span
          className={`whitespace-nowrap text-lg font-bold uppercase tracking-wide text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] sm:text-xl md:text-2xl ${
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
