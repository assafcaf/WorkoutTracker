import { recordsFor, type ExerciseRecord } from './records'
import type { SeriesPoint } from './series'
import { countsTowardStats } from './setKind'
import { loadText } from './setText'
import type { Exercise, ExercisePlan, LibraryExercise, Program, Session } from '../types'

/** The Lifts tab's chart windows: the last month, three months or year. */
export type LiftRange = '1M' | '3M' | '1Y'

const RANGE_MONTHS: Record<LiftRange, number> = { '1M': 1, '3M': 3, '1Y': 12 }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The first instant `range` covers, counted back in calendar months from `now`. */
export function rangeStart(range: LiftRange, now: Date): number {
  const start = new Date(now)
  start.setMonth(start.getMonth() - RANGE_MONTHS[range])
  return start.getTime()
}

/** The points at or after `range`'s start, in the order given. */
export function pointsInRange(points: SeriesPoint[], range: LiftRange, now: Date): SeriesPoint[] {
  const from = rangeStart(range, now)
  return points.filter((point) => point.at >= from)
}

/**
 * The `at` of every point that set a record when it was drawn: the first point, and each one
 * higher than every point before it. Points are read in the order given (oldest first).
 */
export function recordAts(points: SeriesPoint[]): number[] {
  const ats: number[] = []
  let best = -Infinity
  for (const point of points) {
    if (point.value > best) {
      ats.push(point.at)
      best = point.value
    }
  }
  return ats
}

/** The latest value of some points, and how far it moved since the first one. */
export type LiftChange = { latest: number; delta: number; since: number }

/** `points`' change, oldest first; `null` with no points. */
export function liftChange(points: SeriesPoint[]): LiftChange | null {
  if (points.length === 0) return null
  const first = points[0]
  const last = points[points.length - 1]
  return { latest: last.value, delta: last.value - first.value, since: first.at }
}

/** A calendar day as the Lifts tab reads it: `21 Sep` this year, `21 Sep 2025` in another. */
export function shortDay(at: number, now: Date): string {
  const day = new Date(at)
  const text = `${day.getDate()} ${MONTHS[day.getMonth()]}`
  return day.getFullYear() === now.getFullYear() ? text : `${text} ${day.getFullYear()}`
}

/**
 * Every Exercise the trainee has logged a counted Set of, that `resolve` answers: those in the
 * Programs first, in Program order, then the rest by name.
 */
export function loggedLifts(
  sessions: Session[],
  programs: Program[],
  resolve: (id: string) => Exercise | null | undefined,
): Exercise[] {
  const logged = new Map<string, Exercise>()
  for (const session of sessions) {
    for (const entry of session.entries) {
      if (logged.has(entry.exerciseId) || !countsTowardStats(entry)) continue
      const exercise = resolve(entry.exerciseId)
      if (exercise) logged.set(entry.exerciseId, exercise)
    }
  }
  const ordered: Exercise[] = []
  for (const program of programs) {
    for (const workout of program.workouts) {
      for (const plan of workout.exercises) {
        const exercise = logged.get(plan.exerciseId)
        if (exercise && !ordered.includes(exercise)) ordered.push(exercise)
      }
    }
  }
  const rest = [...logged.values()]
    .filter((exercise) => !ordered.includes(exercise))
    .sort((a, b) => a.name.localeCompare(b.name))
  return [...ordered, ...rest]
}

/** One row of the Lifts tab's records table: what the record is, its best as text, and when. */
export type LiftRecordRow = { kind: ExerciseRecord['kind']; label: string; best: string; at: number }

/** `recordsFor` reads nothing of the Plan any more (E16-T2); this one stands in for it. */
const ANY_PLAN: ExercisePlan = { exerciseId: '', sets: 1, repRange: [1, 1], restSeconds: 0 }

const oneDecimal = (value: number): string => String(Math.round(value * 10) / 10)

/**
 * The records the Lifts tab tabulates. A loaded Exercise gets three: its heaviest set (the most
 * reps at its heaviest weight, `62.5 kg × 8`), its best estimated 1RM (`75 kg`), and the most
 * reps in any one Set (`50 kg × 12`; ties go to the heavier weight, then the earliest). A
 * Bodyweight Exercise gets `recordsFor`'s own: most reps in a set (`15 reps`) and, once a Load
 * is logged, the heaviest Load (`BW+10`) and the most reps at it (`BW+10 × 8`).
 */
export function liftRecords(exercise: Exercise, sessions: Session[]): LiftRecordRow[] {
  const records = recordsFor(exercise, ANY_PLAN, sessions)
  if (exercise.bodyweight) {
    const heaviestLoad = records.find((record) => record.kind === 'heaviest-load')?.value
    const load = loadText({ weightKg: null, loadKg: heaviestLoad })
    return records.map((record) => ({
      kind: record.kind,
      label: record.label,
      best:
        record.kind === 'heaviest-load'
          ? load
          : record.kind === 'most-reps-at-load'
            ? `${load} × ${record.reps}`
            : `${record.reps} reps`,
      at: record.at,
    }))
  }
  const heaviest = records.find((record) => record.kind === 'most-reps-at-weight')
  const e1rm = records.find((record) => record.kind === 'best-e1rm')
  if (!heaviest || !e1rm) return []

  const sets = [...sessions]
    .sort((a, b) => a.startedAt - b.startedAt)
    .flatMap((session) =>
      session.entries
        .filter((entry) => entry.exerciseId === exercise.id && countsTowardStats(entry) && entry.weightKg !== null)
        .map((entry) => ({ weightKg: entry.weightKg as number, reps: entry.reps, at: session.startedAt })),
    )
  const mostReps = sets.reduce((acc, set) =>
    set.reps > acc.reps || (set.reps === acc.reps && set.weightKg > acc.weightKg) ? set : acc,
  )

  return [
    { kind: 'heaviest-set', label: 'Heaviest set', best: `${String(heaviest.weightKg)} kg × ${heaviest.reps}`, at: heaviest.at },
    { kind: 'best-e1rm', label: e1rm.label, best: `${oneDecimal(e1rm.value)} kg`, at: e1rm.at },
    { kind: 'most-reps-in-a-set', label: 'Most reps in a set', best: `${mostReps.weightKg} kg × ${mostReps.reps}`, at: mostReps.at },
  ]
}

/** One exercise the search can open: a catalog name or a library name, at its library id. */
export type SearchEntry = { libraryId: string; name: string; muscle: string | null }

/** Catalog exercises first under their own names, then every other library exercise. */
export function searchEntries(catalog: Map<string, Exercise>, library: LibraryExercise[]): SearchEntry[] {
  const byId = new Map(library.map((entry) => [entry.id, entry] as const))
  const seen = new Set<string>()
  const entries: SearchEntry[] = []
  for (const exercise of [...catalog.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    const entry = byId.get(exercise.libraryId)
    if (!entry || seen.has(entry.id)) continue
    seen.add(entry.id)
    entries.push({ libraryId: entry.id, name: exercise.name, muscle: entry.primaryMuscles[0] ?? null })
  }
  for (const entry of [...library].sort((a, b) => a.name.localeCompare(b.name))) {
    if (seen.has(entry.id)) continue
    seen.add(entry.id)
    entries.push({ libraryId: entry.id, name: entry.name, muscle: entry.primaryMuscles[0] ?? null })
  }
  return entries
}
