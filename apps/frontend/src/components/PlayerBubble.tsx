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
  lastWordAcceptedBy,
  rotation = 0,
}: {
  player: GameState['players'][number];
  isActive: boolean;
  isEliminated: boolean;
  x: number;
  y: number;
  highlighted: string | JSX.Element | null;
  isUrgent: boolean;
  lastWordAcceptedBy: string | null;
  rotation?: number;
}) {
  return (
    <div
      className="absolute left-1/2 top-1/2 transition-transform duration-500 ease-in-out"
      style={{
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rotation}deg)`,
      }}
    >
      <div
        className={`absolute -inset-3 -z-10 rounded-xl transition-transform duration-300 ${
          isActive
            ? 'border border-emerald-500/30 bg-emerald-500/10'
            : isEliminated
              ? 'border border-red-500/10 bg-red-500/5'
              : 'bg-indigo-500/5'
        } backdrop-blur-sm ${isActive ? 'scale-110' : 'scale-100'} ${
          isActive && isUrgent ? 'animate-pulse' : ''
        }`}
      />

      {lastWordAcceptedBy === player.id && (
        <div className="flash-ring bg-emerald-500/30" />
      )}

      <div
        className={`rounded-full px-3 py-1 transition-transform ${
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

      <div
        className={`mt-2 rounded px-2 py-1 text-center backdrop-blur-sm transition-transform ${
          isActive ? 'border border-white/10 bg-black/20' : 'bg-black/10'
        }`}
        style={{
          minHeight: '2.25rem', // stable height
          minWidth: '3ch', // enough for 2–3 letters, prevents shrink
        }}
      >
        <span
          className={`inline-block text-lg font-bold uppercase tracking-wide text-white shadow-sm sm:text-xl ${
            isActive && highlighted ? 'animate-typing' : ''
          }`}
          style={{
            visibility: highlighted ? 'visible' : 'hidden',
          }}
        >
          {highlighted ?? '\u200B'}
        </span>
      </div>
    </div>
  );
}

PlayerBubbleComponent.displayName = 'PlayerBubble';

export const PlayerBubble = memo(PlayerBubbleComponent);
