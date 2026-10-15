import type { Session } from '../../types'

/** One calendar week (R-K): Monday 00:00 to Sunday 24:00, local time, by Session `startedAt`. */
export type Week = {
  /** Monday 00:00 local, epoch ms. */
  start: number
  sessions: Session[]
  /** The week `now` falls in: shown "so far", never compared with a full week. */
  inProgress: boolean
}

/** Monday 00:00 local of the calendar week `ms` falls in. */
export function weekStart(_ms: number): number {
  return 0
}

/**
 * Every calendar week from the first Session's week to `now`'s week, empty weeks included,
 * oldest first. No Sessions: an empty list. A deleted Session (`deletedAt`) is ignored.
 */
export function weeksOf(_sessions: Session[], _now: number): Week[] {
  return []
}

/** Sessions done against `sessionsPerWeek` over the last `fullWeeks` complete weeks (R-A). */
export function adherence(
  _sessions: Session[],
  _now: number,
  _sessionsPerWeek: number,
  _fullWeeks: number,
): { done: number; planned: number } {
  return { done: -1, planned: -1 }
}

/** Sessions so far in `now`'s week against `sessionsPerWeek` (R-A). */
export function thisWeek(
  _sessions: Session[],
  _now: number,
  _sessionsPerWeek: number,
): { done: number; planned: number } {
  return { done: -1, planned: -1 }
}
