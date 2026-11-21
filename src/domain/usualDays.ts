// DX-01 / DX-14: the weekdays a trainee usually trains on, and the next of them. Pure; imports
// only src/domain/** and src/types.ts.
//
//   usualDays(sessions, now, weekStartsOn) -> the weekdays (0 = Sunday) trained on in at least 2
//                                             of the last 4 complete weeks
//   nextDayOf(days, now)                   -> the next of `days` strictly after `now`'s day
import { startOfDay } from './sessionsView'
import { weekStart, type Weekday } from './stats/weeks'
import type { Session } from '../types'

/** The weekday names, 0 = Sunday. */
export const LONG_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** The local midnight `days` days after `at`'s day. */
export function addDays(at: number, days: number): number {
  const d = new Date(at)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime()
}

function finished(sessions: Session[]): Session[] {
  return sessions.filter((s) => s.deletedAt === undefined && s.finishedAt != null)
}

/**
 * The weekdays (0 = Sunday) the trainee trained on in at least 2 of the last 4 complete weeks,
 * ascending. A new or irregular trainee has none.
 */
export function usualDays(sessions: Session[], now: number, weekStartsOn: Weekday = 1): number[] {
  const current = weekStart(now, weekStartsOn)
  const from = addDays(current, -28)
  const weeksByDay = new Map<number, Set<number>>()
  for (const s of finished(sessions)) {
    if (s.startedAt < from || s.startedAt >= current) continue
    const day = new Date(s.startedAt).getDay()
    const weeks = weeksByDay.get(day) ?? new Set<number>()
    weeks.add(weekStart(s.startedAt, weekStartsOn))
    weeksByDay.set(day, weeks)
  }
  return [...weeksByDay.entries()].filter(([, weeks]) => weeks.size >= 2).map(([day]) => day).sort((a, b) => a - b)
}

/** The next of `days` strictly after `now`'s day, within 7 days, as local midnight; null with none. */
export function nextDayOf(days: number[], now: number): number | null {
  if (days.length === 0) return null
  for (let i = 1; i <= 7; i += 1) {
    const at = addDays(startOfDay(now), i)
    if (days.includes(new Date(at).getDay())) return at
  }
  return null
}
