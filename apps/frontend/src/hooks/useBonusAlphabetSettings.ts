import { useCallback, useEffect, useState } from 'react';

export interface BonusAlphabetSettings {
  size: 'sm' | 'md';
  position: 'top-left' | 'bottom-left' | 'top-right' | 'bottom-right';
  opacity: number; // 0..1
  showNumbers: boolean;
}

const STORAGE_KEY = 'wordbomb:bonusAlphabetSettings:v1';

const DEFAULT_SETTINGS: BonusAlphabetSettings = {
  size: 'md',
  position: 'top-right',
  opacity: 0.8,
  showNumbers: true,
};

export function useBonusAlphabetSettings() {
  const [settings, setSettings] =
    useState<BonusAlphabetSettings>(DEFAULT_SETTINGS);

  // Load from storage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const o = parsed as Record<string, unknown>;
          const size = o.size;
          const position = o.position;
          const opacity = o.opacity;
          const showNumbers = o.showNumbers;
          if (
            (size === 'sm' || size === 'md') &&
            (position === 'top-left' ||
              position === 'bottom-left' ||
              position === 'top-right' ||
              position === 'bottom-right') &&
            typeof opacity === 'number' &&
            typeof showNumbers === 'boolean'
          ) {
            setSettings({
              size,
              position,
              opacity,
              showNumbers,
            });
          }
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const update = useCallback((next: Partial<BonusAlphabetSettings>) => {
    setSettings((prev) => {
      const merged = { ...prev, ...next } as BonusAlphabetSettings;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch {
        // ignore
      }
      return merged;
    });
  }, []);

  return {
    settings,
    setSettings: update,
    reset: () => setSettings(DEFAULT_SETTINGS),
  };
}
