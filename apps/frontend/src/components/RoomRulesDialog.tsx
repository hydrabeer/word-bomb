import { useEffect, useMemo, useState } from 'react';
import type { LobbyRules } from '../hooks/useRoomRules';
import type { BasicResponse } from '@word-bomb/types/socket';

interface RoomRulesDialogProps {
  open: boolean;
  onClose: () => void;
  rules: LobbyRules;
  isLeader: boolean;
  isUpdating: boolean;
  serverError: string | null;
  onSave: (next: LobbyRules) => Promise<BasicResponse>;
}

const LETTERS = Array.from({ length: 26 }, (_, idx) =>
  String.fromCharCode(65 + idx),
);

const BONUS_MIN = 0;
const BONUS_MAX = 5;

export function RoomRulesDialog({
  open,
  onClose,
  rules,
  isLeader,
  isUpdating,
  serverError,
  onSave,
}: RoomRulesDialogProps) {
  // Initialize from provided rules; component is only rendered when rules is available
  const [draft, setDraft] = useState<LobbyRules>({
    ...rules,
    bonusTemplate: [...rules.bonusTemplate],
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft({ ...rules, bonusTemplate: [...rules.bonusTemplate] });
    setFormError(null);
    setSubmitError(null);
  }, [open, rules]);

  useEffect(() => {
    if (serverError) setSubmitError(serverError);
  }, [serverError]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && open) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  const draftSummary = useMemo(
    () => ({
      ...draft,
      bonusTemplate: draft.bonusTemplate.map((n) =>
        Math.min(BONUS_MAX, Math.max(BONUS_MIN, Math.round(n))),
      ),
      maxLives: Math.min(10, Math.max(1, Math.round(draft.maxLives))),
      startingLives: Math.min(10, Math.max(1, Math.round(draft.startingLives))),
      minTurnDuration: Math.min(
        10,
        Math.max(1, Math.round(draft.minTurnDuration)),
      ),
      minWordsPerPrompt: Math.min(
        1000,
        Math.max(1, Math.round(draft.minWordsPerPrompt)),
      ),
    }),
    [draft],
  );

  if (!open) return null;

  const handleBonusChange = (index: number, value: number) => {
    const clamped = Math.min(BONUS_MAX, Math.max(BONUS_MIN, Math.round(value)));
    setDraft((prev) => {
      const next = [...prev.bonusTemplate];
      next[index] = clamped;
      return { ...prev, bonusTemplate: next };
    });
  };

  const toggleLetter = (index: number) => {
    const current = draft.bonusTemplate[index];
    handleBonusChange(index, current > 0 ? 0 : 1);
  };

  const setAllBonus = (value: number) => {
    setDraft((prev) => ({
      ...prev,
      bonusTemplate: Array.from({ length: 26 }, () => value),
    }));
  };

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!isLeader || isUpdating) return;

    if (draftSummary.startingLives > draftSummary.maxLives) {
      setFormError('Starting lives cannot exceed max lives.');
      return;
    }

    setFormError(null);
    setSubmitError(null);
    const result = await onSave(draftSummary);
    if (result.success) {
      onClose();
    } else if (result.error) {
      setSubmitError(result.error);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="room-rules-heading"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-900 p-6 text-white shadow-2xl"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <header className="mb-6 flex items-start justify-between">
          <div>
            <h2 id="room-rules-heading" className="text-2xl font-semibold">
              Room Rules
            </h2>
            <p className="mt-1 text-sm text-indigo-200/80">
              {isLeader
                ? 'Adjust the game parameters for everyone in this lobby.'
                : 'Only the lobby leader can change these settings.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            aria-label="Close rules"
          >
            ✕
          </button>
        </header>

        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="space-y-8"
        >
          <section>
            <h3 className="text-lg font-semibold text-emerald-300">Lives</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col rounded-xl border border-white/10 bg-white/5 p-4">
                <span className="text-sm text-indigo-200">Starting lives</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={draft.startingLives}
                  onChange={(e) => {
                    setDraft((prev) => ({
                      ...prev,
                      startingLives: Number(e.target.value),
                    }));
                  }}
                  disabled={!isLeader}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-lg font-medium text-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-50"
                />
              </label>
              <label className="flex flex-col rounded-xl border border-white/10 bg-white/5 p-4">
                <span className="text-sm text-indigo-200">Max lives</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={draft.maxLives}
                  onChange={(e) => {
                    setDraft((prev) => ({
                      ...prev,
                      maxLives: Number(e.target.value),
                    }));
                  }}
                  disabled={!isLeader}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-lg font-medium text-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-50"
                />
              </label>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-emerald-300">
              Prompt difficulty
            </h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col rounded-xl border border-white/10 bg-white/5 p-4">
                <span className="text-sm text-indigo-200">
                  Minimum words per prompt (WPP)
                </span>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={draft.minWordsPerPrompt}
                  onChange={(e) => {
                    setDraft((prev) => ({
                      ...prev,
                      minWordsPerPrompt: Number(e.target.value),
                    }));
                  }}
                  disabled={!isLeader}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-lg font-medium text-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-50"
                />
                <span className="mt-2 text-xs text-indigo-200/70">
                  Higher numbers mean easier fragments.
                </span>
              </label>
              <label className="flex flex-col rounded-xl border border-white/10 bg-white/5 p-4">
                <span className="text-sm text-indigo-200">
                  Minimum turn duration (seconds)
                </span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={draft.minTurnDuration}
                  onChange={(e) => {
                    setDraft((prev) => ({
                      ...prev,
                      minTurnDuration: Number(e.target.value),
                    }));
                  }}
                  disabled={!isLeader}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-lg font-medium text-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-50"
                />
                <span className="mt-2 text-xs text-indigo-200/70">
                  The timer never drops below this limit.
                </span>
              </label>
            </div>
          </section>

          <section>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-semibold text-emerald-300">
                Bonus alphabet
              </h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAllBonus(1);
                  }}
                  disabled={!isLeader}
                  className="rounded-md border border-emerald-400/60 px-3 py-1 text-sm text-emerald-200 transition hover:bg-emerald-400/10 disabled:opacity-50"
                >
                  Enable all
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAllBonus(0);
                  }}
                  disabled={!isLeader}
                  className="rounded-md border border-red-400/60 px-3 py-1 text-sm text-red-200 transition hover:bg-red-400/10 disabled:opacity-50"
                >
                  Disable all
                </button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8">
              {LETTERS.map((letter, idx) => {
                const value = draft.bonusTemplate[idx];
                const enabled = value > 0;
                return (
                  <div
                    key={letter}
                    className={`rounded-xl border p-3 text-center transition ${
                      enabled
                        ? 'border-emerald-400/60 bg-emerald-500/10'
                        : 'border-white/10 bg-white/5 opacity-80'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        toggleLetter(idx);
                      }}
                      disabled={!isLeader}
                      className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
                      aria-label={
                        enabled
                          ? `Disable letter ${letter}`
                          : `Enable letter ${letter}`
                      }
                    >
                      {letter}
                    </button>
                    <input
                      type="number"
                      min={BONUS_MIN}
                      max={BONUS_MAX}
                      value={value}
                      onChange={(e) => {
                        handleBonusChange(idx, Number(e.target.value));
                      }}
                      disabled={!isLeader}
                      className="mt-2 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm text-white focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 disabled:opacity-50"
                    />
                  </div>
                );
              })}
            </div>
          </section>

          {(formError ?? submitError) && (
            <div className="rounded-lg border border-red-400/60 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {formError ?? submitError}
            </div>
          )}

          <footer className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isLeader || isUpdating}
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUpdating ? 'Saving…' : 'Save changes'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
