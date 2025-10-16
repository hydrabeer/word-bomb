import { noop } from '@game/domain/utils/noop';
import type { BasicResponse } from '@word-bomb/types/socket';

/**
 * Safely coerces optional acknowledgement callbacks supplied by Socket.IO.
 *
 * @param cb - Possible acknowledgement callback supplied by the client.
 * @returns A callable handler that defaults to {@link noop}.
 */
export function normalizeAck(cb: unknown): (res: BasicResponse) => void {
  return typeof cb === 'function' ? (cb as (res: BasicResponse) => void) : noop;
}
