import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoom, checkRoomExists } from './rooms';

// Ensure fetch is mocked
const g = globalThis as unknown as { fetch: unknown };

describe('api/rooms', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('createRoom returns code on success', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ code: 'ABCD' }),
    });
    g.fetch = mockFetch as unknown as typeof fetch;

    const res = await createRoom();
    expect(res).toEqual({ code: 'ABCD' });
    expect(mockFetch).toHaveBeenCalled();
  });

  it('createRoom throws on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false });
    g.fetch = mockFetch as unknown as typeof fetch;

    await expect(createRoom()).rejects.toThrow('Failed to create room');
  });

  it('checkRoomExists returns true/false based on response.ok', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false });
    g.fetch = mockFetch as unknown as typeof fetch;

    await expect(checkRoomExists('ROOM')).resolves.toBe(true);
    await expect(checkRoomExists('MISSING')).resolves.toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
