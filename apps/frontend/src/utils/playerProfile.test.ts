import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getOrCreatePlayerProfile, updatePlayerName } from './playerProfile';

// minimal localStorage mock (jsdom provides one but we reset carefully)

const STORAGE_KEY = 'wordbomb:profile:v1';

describe('playerProfile', () => {
  beforeEach(() => {
    localStorage.clear();
    // deterministic uuid
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '123e4567-e89b-12d3-a456-426614174000',
    );
  });

  it('creates a profile when none exists', () => {
    const profile = getOrCreatePlayerProfile();
    expect(profile.id).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(profile.name).toMatch(/^Guest\d{4}$/);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as {
      id: string;
      name: string;
    };
    expect(stored.id).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  it('reuses existing profile', () => {
    const first = getOrCreatePlayerProfile();
    const second = getOrCreatePlayerProfile();
    expect(second).toEqual(first); // same persisted profile
  });

  it('updates player name', () => {
    getOrCreatePlayerProfile();
    updatePlayerName('NewName');
    const updated = getOrCreatePlayerProfile();
    expect(updated.name).toBe('NewName');
  });
});
