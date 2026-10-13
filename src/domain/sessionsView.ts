import type { ExercisePlan, LibraryExercise, Program, Session } from '../types'
import { muscleSets, toRegionCounts, type Region, type Resolve } from './muscles'
import { workingSets } from './setKind'
import { recordCount, summarize } from './summary'
import { volumeSeries } from './volume'

// What the Sessions tab (Progress Dashboard S6a) draws, derived purely from Sessions and a
// `now`: a calendar of the last weeks, the regions' sets per week, and the Sessions grouped by
// week. Weeks start on Monday, in local time.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Local midnight of the day `at` falls on. */
export function startOfDay(at: number): number {
  const day = new Date(at)
  day.setHours(0, 0, 0, 0)
  return day.getTime()
}

/** `at` moved by `days` calendar days (local time, so a DST change keeps midnight at midnight). */
function addDays(at: number, days: number): number {
  const day = new Date(at)
  day.setDate(day.getDate() + days)
  return day.getTime()
}

/** Local midnight of the Monday of the week `at` falls in. */
export function startOfWeek(at: number): number {
  const day = new Date(startOfDay(at))
  const sinceMonday = (day.getDay() + 6) % 7
  return addDays(day.getTime(), -sinceMonday)
}

/** A day as `7 Sep`, with the year added when it is not `now`'s: `7 Sep 2025`. */
export function dayMonth(at: number, now: number): string {
  const day = new Date(at)
  const text = `${day.getDate()} ${MONTHS[day.getMonth()]}`
  return day.getFullYear() === new Date(now).getFullYear() ? text : `${text} ${day.getFullYear()}`
}

export type CalendarDay = { at: number; trained: boolean; today: boolean; future: boolean }
export type CalendarWeek = { start: number; days: CalendarDay[] }

/** The week starts of the `count` weeks ending with `now`'s, oldest first. */
export function weekStarts(now: number, count: number): number[] {
  const current = startOfWeek(now)
  return Array.from({ length: count }, (_, index) => addDays(current, -7 * (count - 1 - index)))
}

/**
 * The last `count` weeks (Monday to Sunday, the one holding `now` last), each day marked
 * `trained` when a Session started on it, `today` on `now`'s day and `future` after it.
 */
export function calendarWeeks(sessions: Session[], now: number, count: number): CalendarWeek[] {
  const today = startOfDay(now)
  const trainedDays = new Set(sessions.map((session) => startOfDay(session.startedAt)))
  return weekStarts(now, count).map((start) => ({
    start,
    days: Array.from({ length: 7 }, (_, index) => {
      const at = addDays(start, index)
      return { at, trained: trainedDays.has(at), today: at === today, future: at > today }
    }),
  }))
}

/** How many Sessions started from the first of the last `count` weeks up to `now`. */
export function sessionsInWeeks(sessions: Session[], now: number, count: number): number {
  const from = weekStarts(now, count)[0]
  return sessions.filter((session) => session.startedAt >= from && session.startedAt <= now).length
}

export type WeekRegionSets = { start: number; counts: Map<Region, number> }

/**
 * Per week of the last `count` (oldest first), the sets each Region got from the Sessions
 * started in it -- `muscleSets` (1 per primary, 0.5 per secondary muscle, warm-ups out) folded
 * into Regions by `toRegionCounts`, as the body map counts them.
 */
export function weeklyRegionSets(
  sessions: Session[],
  now: number,
  count: number,
  resolve: Resolve,
  library: Map<string, LibraryExercise>,
): WeekRegionSets[] {
  return weekStarts(now, count).map((start) => {
    const end = addDays(start, 7)
    const entries = sessions
      .filter((session) => session.startedAt >= start && session.startedAt < end)
      .flatMap((session) => session.entries)
    return { start, counts: toRegionCounts(muscleSets(entries, resolve, library)) }
  })
}

export type SessionWeek = { start: number; label: string; sessions: Session[] }

/**
 * The Sessions grouped by the week they started in, newest week and newest Session first:
 * `This week`, `Last week`, then `Week of 21 Sep`.
 */
export function sessionsByWeek(sessions: Session[], now: number): SessionWeek[] {
  const thisWeek = startOfWeek(now)
  const lastWeek = addDays(thisWeek, -7)
  const weeks = new Map<number, Session[]>()
  for (const session of [...sessions].sort((a, b) => b.startedAt - a.startedAt)) {
    const start = startOfWeek(session.startedAt)
    weeks.set(start, [...(weeks.get(start) ?? []), session])
  }
  return [...weeks.entries()]
    .sort(([a], [b]) => b - a)
    .map(([start, grouped]) => ({
      start,
      label:
        start === thisWeek ? 'This week' : start === lastWeek ? 'Last week' : `Week of ${dayMonth(start, now)}`,
      sessions: grouped,
    }))
}

export type HeatRow = { label: string; region: Region }

/** The rows every region heat table shows, in the mock's order. */
export const HEAT_ROWS: HeatRow[] = [
  { label: 'Chest', region: 'chest' },
  { label: 'Shoulders', region: 'front-deltoids' },
  { label: 'Triceps', region: 'triceps' },
  { label: 'Upper back', region: 'upper-back' },
  { label: 'Biceps', region: 'biceps' },
  { label: 'Quads', region: 'quadriceps' },
  { label: 'Lower back', region: 'lower-back' },
  { label: 'Hamstrings', region: 'hamstring' },
  { label: 'Glutes', region: 'gluteal' },
  { label: 'Calves', region: 'calves' },
  { label: 'Abs', region: 'abs' },
]

/** Rows shown only when some count reaches them; `back-deltoids` and `obliques` mirror rows above. */
const EXTRA_ROWS: HeatRow[] = [
  { label: 'Traps', region: 'trapezius' },
  { label: 'Forearms', region: 'forearm' },
  { label: 'Adductors', region: 'adductor' },
  { label: 'Abductors', region: 'abductors' },
  { label: 'Neck', region: 'neck' },
]

/** `HEAT_ROWS`, plus each extra Region any of `counts` gives a set to. */
export function heatRowsFor(counts: Map<Region, number>[]): HeatRow[] {
  return [
    ...HEAT_ROWS,
    ...EXTRA_ROWS.filter((row) => counts.some((map) => (map.get(row.region) ?? 0) > 0)),
  ]
}

/** A set count as a heat cell reads it: `7`, or `2.5` where a secondary muscle added half. */
export function formatSetCount(count: number): string {
  return String(Math.round(count * 10) / 10)
}

/** A Session row's figures: whole minutes, loaded volume in whole kg, and the records it set. */
export function sessionRowStats(
  session: Session,
  earlier: Session[],
  resolve: Resolve,
  planFor: (exerciseId: string) => ExercisePlan | undefined,
): { minutes: number; volumeKg: number; prs: number } {
  const stats = summarize(session, earlier, resolve, planFor)
  return {
    minutes: Math.max(0, Math.round(stats.durationMs / 60_000)),
    volumeKg: Math.round(stats.volumeKg),
    prs: recordCount(stats),
  }
}

/** The Session's working Sets: every Set but a warm-up. */
export function workingSetCount(session: Session): number {
  return workingSets(session.entries).length
}

export type VolumeBar = { at: number; label: string; value: number; series?: 'b' }

/**
 * The last `limit` Sessions' loaded volume as bars, oldest first. A Session of its Program's
 * first Workout is series A, any other Workout series B, and the legend names each series
 * present by its Workout (`A`, `B` for `Workout A`, `Workout B`).
 */
export function volumeBars(
  sessions: Session[],
  resolve: Resolve,
  programs: Program[],
  limit = 12,
): { bars: VolumeBar[]; legend: Array<{ label: string; series?: 'b' }> } {
  const points = volumeSeries(sessions, resolve, programs).slice(-limit)
  const ordered = [...sessions].sort((a, b) => a.startedAt - b.startedAt).slice(-limit)
  const legend = new Map<string, { label: string; series?: 'b' }>()
  const bars = points.map((point, index) => {
    const session = ordered[index]
    const program = programs.find((candidate) => candidate.id === session.programId)
    const position = program?.workouts.findIndex((workout) => workout.id === session.workoutId) ?? 0
    const series = position > 0 ? ('b' as const) : undefined
    const key = series ?? 'a'
    if (!legend.has(key)) legend.set(key, { label: point.workoutName.replace(/^Workout\s+/i, ''), series })
    return { at: point.at, label: point.workoutName, value: Math.round(point.kg), ...(series ? { series } : {}) }
  })
  return { bars, legend: [...legend.values()].sort((a, b) => (a.series ? 1 : 0) - (b.series ? 1 : 0)) }
}
