import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoom, checkRoomExists } from './rooms';

// Ensure fetch is mocked
const g = globalThis as unknown as { fetch: unknown };

describe('api/rooms', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('createRoom returns code on success and sends name', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ code: 'ABCD' }),
    });
    g.fetch = mockFetch as unknown as typeof fetch;

    const res = await createRoom('My Room');
    expect(res).toEqual({ code: 'ABCD' });
    expect(mockFetch).toHaveBeenCalled();
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/rooms');
    expect(opts.method).toBe('POST');
    expect(opts.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(opts.body).toBe(JSON.stringify({ name: 'My Room' }));
  });

  it('createRoom throws on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false });
    g.fetch = mockFetch as unknown as typeof fetch;

    await expect(createRoom()).rejects.toThrow('Failed to create room');
  });

  it('checkRoomExists returns exists and name when ok', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ exists: true, name: 'R' }),
      })
      .mockResolvedValueOnce({ ok: false });
    g.fetch = mockFetch as unknown as typeof fetch;

    await expect(checkRoomExists('ROOM')).resolves.toEqual({
      exists: true,
      name: 'R',
    });
    await expect(checkRoomExists('MISSING')).resolves.toEqual({
      exists: false,
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
