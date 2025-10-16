import { describe, it, expect, vi } from 'vitest';
import { normalizeAck } from './acknowledgement';
import { noop } from '@game/domain/utils/noop';
import type { BasicResponse } from '@word-bomb/types/socket';

describe('normalizeAck', () => {
  it('returns the provided acknowledgement when it is callable', () => {
    const ack = vi.fn();
    const normalized = normalizeAck(ack);

    const payload = { success: true } as BasicResponse;
    normalized(payload);

    expect(normalized).toBe(ack);
    expect(ack).toHaveBeenCalledWith(payload);
  });

  it('falls back to noop when acknowledgement is missing or invalid', () => {
    const normalized = normalizeAck(undefined);

    expect(normalized).toBe(noop);
    expect(() => normalized({ success: false } as BasicResponse)).not.toThrow();
  });
});
