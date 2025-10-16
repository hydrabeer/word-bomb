/**
 * Configurable grace period (ms) before removing a disconnected player.
 */
export let DISCONNECT_GRACE_MS = 10000;

/**
 * Overrides the disconnection grace period used when scheduling player cleanup.
 *
 * @param ms - New timeout in milliseconds before a disconnected player is removed.
 */
export function setDisconnectGrace(ms: number): void {
  DISCONNECT_GRACE_MS = ms;
}
