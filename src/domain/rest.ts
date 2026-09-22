/**
 * The rest timer's state, derived only from timestamps so a slept phone cannot desync it.
 *
 * `lastLoggedAt: null` means rest is over. `remainingSeconds` is clamped at 0.
 */
export function restState(
  lastLoggedAt: number | null,
  restSeconds: number,
  now: number,
): { remainingSeconds: number; isOver: boolean } {
  if (lastLoggedAt === null) {
    return { remainingSeconds: 0, isOver: true }
  }

  const elapsedSeconds = (now - lastLoggedAt) / 1000
  const remainingSeconds = Math.max(0, restSeconds - elapsedSeconds)

  return { remainingSeconds, isOver: elapsedSeconds >= restSeconds }
}
