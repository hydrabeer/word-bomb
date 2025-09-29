import type { BonusProgressView } from '@word-bomb/types/socket';

export interface BonusAlphabetSettings {
  size?: 'sm' | 'md';
  position?: 'top-left' | 'bottom-left' | 'top-right' | 'bottom-right';
  opacity?: number; // 0..1
  showNumbers?: boolean; // show remaining counter
}

export interface BonusAlphabetProps {
  progress: BonusProgressView | null | undefined;
  settings?: BonusAlphabetSettings;
}

const posClass: Record<
  NonNullable<BonusAlphabetSettings['position']>,
  string
> = {
  // Use slightly larger safe margins on small+ screens to avoid edges
  'top-left': 'top-2 left-2 sm:top-4 sm:left-4',
  'top-right': 'top-2 right-2 sm:top-4 sm:right-4',
  'bottom-left': 'bottom-2 left-2 sm:bottom-4 sm:left-4',
  'bottom-right': 'bottom-2 right-2 sm:bottom-4 sm:right-4',
};

export function BonusAlphabet({ progress, settings }: BonusAlphabetProps) {
  if (!progress) return null;
  const size = settings?.size ?? 'md';
  const position = settings?.position ?? 'top-right';
  const opacity = settings?.opacity ?? 0.75;
  const showNumbers = settings?.showNumbers ?? true;

  // Make tiles larger while keeping readable text
  const tile = size === 'sm' ? 'w-6 h-6 text-[11px]' : 'w-8 h-8 text-sm';

  return (
    <div
      className={`pointer-events-none absolute z-10 ${posClass[position]} grid grid-cols-2 gap-[4px]`}
      style={{ opacity }}
      aria-hidden="true"
    >
      {Array.from({ length: 26 })
        .map((_, i) => i)
        .filter((i) => (progress.total[i] ?? 0) > 0)
        .map((i) => {
          const letter = String.fromCharCode(65 + i);
          const remaining = progress.remaining[i] ?? 0;
          const total = progress.total[i] ?? 0;
          const required = Math.max(total, 0);
          const done = remaining <= 0;
          const active = required > 0;
          const completedCount = required - Math.max(remaining, 0);
          const ratio = required > 0 ? completedCount / required : 1;
          const tileBgClass = done
            ? 'bg-white/10'
            : 'bg-emerald-500/20 ring-1 ring-emerald-400/30';
          return (
            <div
              key={letter}
              className={`${tile} relative flex items-center justify-center rounded ${tileBgClass} backdrop-blur-sm`}
              style={{
                filter: done ? 'grayscale(100%)' : undefined,
                opacity: active ? 1 : 0.35,
                boxShadow:
                  active && completedCount > 0
                    ? `inset 0 -${String(Math.round(ratio * 100))}% 0 0 rgba(16,185,129,0.28)`
                    : undefined,
              }}
              title={`${letter}${active ? ` (${String(completedCount)}/${String(required)})` : ''}`}
            >
              <span
                className={`font-bold ${done ? 'text-white/60' : 'text-white'}`}
              >
                {letter}
              </span>
              {active && showNumbers && total > 1 && remaining > 0 && (
                <span className="absolute -right-1 -top-1 rounded bg-black/70 px-[3px] py-[1px] text-[9px] leading-none text-white">
                  {remaining}
                </span>
              )}
            </div>
          );
        })}
    </div>
  );
}
