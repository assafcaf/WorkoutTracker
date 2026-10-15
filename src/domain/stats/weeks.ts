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
export function weekStart(ms: number): number {
  const d = new Date(ms)
  const sinceMonday = (d.getDay() + 6) % 7
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - sinceMonday).getTime()
}

/** The Monday 00:00 local that follows the week starting at `start` (DST-safe). */
function nextWeek(start: number): number {
  const d = new Date(start)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7).getTime()
}

/**
 * Every calendar week from the first Session's week to `now`'s week, empty weeks included,
 * oldest first. No Sessions: an empty list. A deleted Session (`deletedAt`) is ignored.
 */
export function weeksOf(sessions: Session[], now: number): Week[] {
  const live = sessions.filter((s) => s.deletedAt === undefined)
  if (live.length === 0) return []
  const current = weekStart(now)
  const first = Math.min(weekStart(Math.min(...live.map((s) => s.startedAt))), current)
  const weeks: Week[] = []
  const byStart = new Map<number, Week>()
  for (let start = first; start <= current; start = nextWeek(start)) {
    const week: Week = { start, sessions: [], inProgress: start === current }
    weeks.push(week)
    byStart.set(start, week)
  }
  for (const s of [...live].sort((a, b) => a.startedAt - b.startedAt)) {
    byStart.get(weekStart(s.startedAt))?.sessions.push(s)
  }
  return weeks
}

/** Sessions done against `sessionsPerWeek` over the last `fullWeeks` complete weeks (R-A). */
export function adherence(
  sessions: Session[],
  now: number,
  sessionsPerWeek: number,
  fullWeeks: number,
): { done: number; planned: number } {
  const complete = weeksOf(sessions, now).filter((w) => !w.inProgress)
  const last = fullWeeks > 0 ? complete.slice(-fullWeeks) : []
  return {
    done: last.reduce((sum, w) => sum + w.sessions.length, 0),
    planned: last.length * sessionsPerWeek,
  }
}

/** Sessions so far in `now`'s week against `sessionsPerWeek` (R-A). */
export function thisWeek(
  sessions: Session[],
  now: number,
  sessionsPerWeek: number,
): { done: number; planned: number } {
  const current = weeksOf(sessions, now).find((w) => w.inProgress)
  return { done: current?.sessions.length ?? 0, planned: sessionsPerWeek }
}
