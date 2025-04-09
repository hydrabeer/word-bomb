import { generateGuestName } from './generateGuestName.ts';

export interface PlayerProfile {
  id: string;
  name: string;
}

const STORAGE_KEY = 'wordbomb:profile:v1';

export function getOrCreatePlayerProfile(): PlayerProfile {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as PlayerProfile;
    } catch {
      // fallback to new profile if corrupted
    }
  }

  const profile: PlayerProfile = {
    id: crypto.randomUUID(),
    name: generateGuestName(), // or just "Guest1234"
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  return profile;
}

export function updatePlayerName(name: string): void {
  const profile = getOrCreatePlayerProfile();
  profile.name = name;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}
