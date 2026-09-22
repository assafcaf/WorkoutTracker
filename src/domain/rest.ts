/**
 * The rest timer's state, derived only from timestamps so a slept phone cannot desync it.
 *
 * `lastLoggedAt: null` means rest is over. `remainingSeconds` is clamped at 0.
 */
export function restState(
  _lastLoggedAt: number | null,
  _restSeconds: number,
  _now: number,
): { remainingSeconds: number; isOver: boolean } {
  throw new Error('not implemented')
}
