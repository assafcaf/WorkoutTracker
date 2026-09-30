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
): { remainingSeconds: number; isOver: boolean } {
  if (lastLoggedAt === null) {
    return { remainingSeconds: 0, isOver: true }
  }

  const elapsedSeconds = (now - lastLoggedAt) / 1000
  const remainingSeconds = Math.max(0, restSeconds - elapsedSeconds)

  return { remainingSeconds, isOver: elapsedSeconds >= restSeconds }
}

export type RestState = { remainingSeconds: number; overSeconds: number; isOver: boolean }

export type RestAdjustment =
  | { kind: 'skip' }
  | { kind: 'add'; seconds: 15 | -15 }
  | { kind: 'set'; seconds: number }

// Stubs (E13-T1): replaced by the implementation.
export function latestSet(_entries: SetEntry[]): SetEntry | null {
  return undefined as unknown as SetEntry | null
}

export function restAfter(_entry: SetEntry, _planRestSeconds: number, _now: number): RestState {
  return undefined as unknown as RestState
}

export function adjustRest(
  _entry: SetEntry,
  _planRestSeconds: number,
  _adjustment: RestAdjustment,
  _now: number,
): number {
  return Number.NaN
}

export function formatRest(_seconds: number): string {
  return ''
}

export function formatOver(_seconds: number): string {
  return ''
}
