// DX-01: the Train tab's one meta line under the Workout's name, and whether today is a rest day.
// Pure: it reads the finished Sessions, the Program's sessions per week, the Reminders' weekdays
// and the clock.
//
//   usualDays(sessions, now, weekStartsOn) -> the weekdays (0 = Sunday) trained on in at least 2
//                                             of the last 4 complete weeks
//   trainDayOf(input)                      -> { rest, meta }
import { startOfDay } from '../../domain/sessionsView'
import { thisWeek, weekStart, type Weekday } from '../../domain/stats/weeks'
import { addDays, LONG_DAYS, nextDayOf, usualDays } from '../../domain/usualDays'
import type { Session } from '../../types'

function finished(sessions: Session[]): Session[] {
  return sessions.filter((s) => s.deletedAt === undefined && s.finishedAt != null)
}

export { usualDays }

export type TrainDayInput = {
  sessions: Session[]
  now: number
  sessionsPerWeek: number
  weekStartsOn: Weekday
  /** The Reminders' weekdays (0 = Sunday); null or empty when none are set. */
  reminders: number[] | null
  /** The Workout due next, for the rest day's "next:". */
  dueName: string | null
}

export type TrainDay = {
  /** A rest day: Start still works, as an outline "Start … anyway". */
  rest: boolean
  /** `Thursday · 2 of 3 this week`, or `Rest day · next: Workout B, Friday`. */
  meta: string
}

/**
 * Without Reminders, whether today is off the trainee's usual days with the week's sessions still
 * fitting on the usual days left in it: a Mon/Wed/Fri lifter with 1 left on Thursday rests (Friday
 * takes it), but with 2 left Thursday is needed.
 */
function offUsualDay(usual: number[], now: number, weekStartsOn: Weekday, left: number): boolean {
  if (usual.length === 0 || usual.includes(new Date(now).getDay())) return false
  const weekEnd = addDays(weekStart(now, weekStartsOn), 7)
  let usualLeft = 0
  for (let at = addDays(startOfDay(now), 1); at < weekEnd; at = addDays(at, 1)) {
    if (usual.includes(new Date(at).getDay())) usualLeft += 1
  }
  return usualLeft >= left
}

/**
 * Whether today is a rest day, and the meta line. Today is a rest day once a Session is
 * finished today, once the week's sessions are all done, when Reminders are set and today is
 * not one of their days, or -- without Reminders -- when today is off the usual days and the
 * sessions left still fit on the usual days left this week (DX-01). Otherwise it is a training day: the trainee has sessions left this week.
 * A rest day names the Workout due and, when known (the Reminders' days, else the usual ones),
 * the day it falls on.
 */
export function trainDayOf(input: TrainDayInput): TrainDay {
  const { now, sessionsPerWeek, weekStartsOn, dueName } = input
  const sessions = finished(input.sessions)
  const week = thisWeek(sessions, now, sessionsPerWeek, weekStartsOn)
  const today0 = startOfDay(now)
  const doneToday = sessions.some((s) => startOfDay(s.finishedAt ?? s.startedAt) === today0)
  const reminders = input.reminders ?? []
  const usual = reminders.length > 0 ? [] : usualDays(sessions, now, weekStartsOn)
  const offDay =
    reminders.length > 0 ? !reminders.includes(new Date(now).getDay()) : offUsualDay(usual, now, weekStartsOn, week.planned - week.done)
  const rest = doneToday || week.done >= week.planned || offDay
  if (!rest) {
    return { rest, meta: `${LONG_DAYS[new Date(now).getDay()]} · ${week.done} of ${week.planned} this week` }
  }
  const days = reminders.length > 0 ? reminders : usual
  const next = nextDayOf(days, now)
  const lead = doneToday ? 'Done today' : 'Rest day'
  if (dueName === null) return { rest, meta: lead }
  return { rest, meta: `${lead} · next: ${dueName}${next === null ? '' : `, ${LONG_DAYS[new Date(next).getDay()]}`}` }
}
