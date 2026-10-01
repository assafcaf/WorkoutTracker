import type { SetEntry } from '../types'

/**
 * The rest timer's state, derived only from timestamps so a slept phone cannot desync it.
 *
 * `lastLoggedAt: null` means rest is over. `remainingSeconds` is clamped at 0.
 */
export function restState(
  lastLoggedAt: number | null,
  restSeconds: number,
  now: number,
): RestState {
  if (lastLoggedAt === null) {
    return { remainingSeconds: 0, overSeconds: 0, isOver: true }
  }

  const elapsedSeconds = (now - lastLoggedAt) / 1000
  const remainingSeconds = Math.max(0, restSeconds - elapsedSeconds)

  const isOver = elapsedSeconds >= restSeconds
  return { remainingSeconds, overSeconds: isOver ? elapsedSeconds - restSeconds : 0, isOver }
}

export type RestState = { remainingSeconds: number; overSeconds: number; isOver: boolean }

export type RestAdjustment =
  | { kind: 'skip' }
  | { kind: 'add'; seconds: 15 | -15 }
  | { kind: 'set'; seconds: number }

/** The entry with the greatest `loggedAt`, or null when there are none. */
export function latestSet(entries: SetEntry[]): SetEntry | null {
  let latest: SetEntry | null = null
  for (const e of entries) if (latest === null || e.loggedAt > latest.loggedAt) latest = e
  return latest
}

/** The rest after a Warm-up Set that stored none, at most (E15-T2). */
export const WARMUP_REST_SECONDS = 60

/** The rest after `entry`: its own `restSeconds`, else 60 s at most for a Warm-up, else the Plan's. */
export function restLengthOf(entry: SetEntry, planRestSeconds: number): number {
  if (entry.restSeconds !== undefined) return entry.restSeconds
  return entry.kind === 'warmup' ? Math.min(WARMUP_REST_SECONDS, planRestSeconds) : planRestSeconds
}

/** Rest after `entry`: its own `restSeconds` when set, else the Plan's. */
export function restAfter(entry: SetEntry, planRestSeconds: number, now: number): RestState {
  return restState(entry.loggedAt, restLengthOf(entry, planRestSeconds), now)
}

/** The Set's new rest length after `adjustment`. Elapsed is floored to whole seconds. */
export function adjustRest(
  entry: SetEntry,
  planRestSeconds: number,
  adjustment: RestAdjustment,
  now: number,
): number {
  const elapsed = Math.max(0, Math.floor((now - entry.loggedAt) / 1000))
  switch (adjustment.kind) {
    case 'skip':
      return elapsed
    case 'set':
      return adjustment.seconds
    case 'add':
      return Math.max(elapsed, restLengthOf(entry, planRestSeconds) + adjustment.seconds)
  }
}

function mss(seconds: number): string {
  const total = Math.ceil(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** The remaining rest as "m:ss", counting the part-second still to go as a whole one. */
export function formatRest(seconds: number): string {
  return mss(seconds)
}

/** Time past the rest as "+m:ss". */
export function formatOver(seconds: number): string {
  return `+${mss(seconds)}`
}
