import type { LibraryExercise, Muscle, Program, Session, Workout } from '../../types'
import { contributors, muscleSets, type Resolve } from '../muscles'
import { weeksOf } from './weeks'

/** The 12 muscles of R-M, in the order the table shows them. */
export const STATS_MUSCLES: readonly Muscle[] = [
  'chest',
  'shoulders',
  'triceps',
  'lats',
  'middle back',
  'biceps',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'lower back',
  'abdominals',
]

/** One calendar week's sets per muscle (all 14 counted muscles, 0 when untrained). */
export type MuscleWeek = { start: number; inProgress: boolean; sets: Map<Muscle, number> }

/** Done so far this week and what the rotation still owes (R-M). */
export type ThisWeekMuscle = { done: number; stillPlanned: number }

/** Working sets per muscle for every R-K week, oldest first, empty weeks included. */
export function muscleWeeks(
  sessions: Session[],
  now: number,
  resolve: Resolve,
  library: Map<string, LibraryExercise>,
): MuscleWeek[] {
  return weeksOf(sessions, now).map((w) => ({
    start: w.start,
    inProgress: w.inProgress,
    sets: muscleSets(
      w.sessions.flatMap((s) => s.entries),
      resolve,
      library,
    ),
  }))
}

/** The Plan sets of `workout` per muscle, each set weighted by `weight` (1 primary, 0.5 secondary). */
function planSets(
  workout: Workout,
  weight: number,
  resolve: Resolve,
  library: Map<string, LibraryExercise>,
  into: Map<Muscle, number>,
): void {
  for (const plan of workout.exercises) {
    const exercise = resolve(plan.exerciseId)
    const lib = exercise && library.get(exercise.libraryId)
    if (!lib) continue
    for (const m of lib.primaryMuscles) into.set(m, (into.get(m) ?? 0) + plan.sets * weight)
    for (const m of lib.secondaryMuscles) into.set(m, (into.get(m) ?? 0) + plan.sets * weight * 0.5)
  }
}

/** Planned sets per week: plan sets x `sessionsPerWeek / workouts`, 1 primary, 0.5 secondary. */
export function plannedPerWeek(
  program: Program,
  resolve: Resolve,
  library: Map<string, LibraryExercise>,
): Map<Muscle, number> {
  const out = new Map<Muscle, number>()
  if (program.workouts.length === 0) return out
  const weight = program.sessionsPerWeek / program.workouts.length
  for (const workout of program.workouts) planSets(workout, weight, resolve, library, out)
  return out
}

/** The average of the last `weeks` (default 2) complete weeks' sets per muscle. */
export function windowAverage(
  sessions: Session[],
  now: number,
  resolve: Resolve,
  library: Map<string, LibraryExercise>,
  weeks = 2,
): Map<Muscle, number> {
  const complete = muscleWeeks(sessions, now, resolve, library).filter((w) => !w.inProgress)
  const last = weeks > 0 ? complete.slice(-weeks) : []
  const out = new Map<Muscle, number>()
  if (last.length === 0) return out
  for (const w of last) {
    for (const [m, n] of w.sets) out.set(m, (out.get(m) ?? 0) + n)
  }
  for (const [m, n] of out) out.set(m, n / last.length)
  return out
}

/** Per muscle: done so far this week, plus the Plan sets of the workouts still owed. */
export function thisWeekMuscles(
  sessions: Session[],
  program: Program,
  now: number,
  resolve: Resolve,
  library: Map<string, LibraryExercise>,
): Map<Muscle, ThisWeekMuscle> {
  const out = new Map<Muscle, ThisWeekMuscle>()
  const current = muscleWeeks(sessions, now, resolve, library).find((w) => w.inProgress)
  const done = current?.sets ?? new Map<Muscle, number>()
  const owed = new Map<Muscle, number>()

  const live = sessions.filter((s) => s.deletedAt === undefined)
  const inWeek = weeksOf(sessions, now).find((w) => w.inProgress)?.sessions.length ?? 0
  const remaining = Math.max(0, Math.round(program.sessionsPerWeek - inWeek))
  const count = program.workouts.length
  if (count > 0) {
    const latest = live.reduce<Session | undefined>(
      (best, s) => (!best || s.startedAt > best.startedAt ? s : best),
      undefined,
    )
    const latestIndex = latest ? program.workouts.findIndex((w) => w.id === latest.workoutId) : -1
    for (let i = 1; i <= remaining; i++) {
      planSets(program.workouts[(latestIndex + i) % count], 1, resolve, library, owed)
    }
  }

  for (const m of new Set([...done.keys(), ...owed.keys()])) {
    out.set(m, { done: done.get(m) ?? 0, stillPlanned: owed.get(m) ?? 0 })
  }
  return out
}

/**
 * Each lift's exact fractional working sets toward `muscle` in Sessions started in
 * `[from, to)`. The sets sum to the muscle's total.
 */
export function muscleContributors(
  sessions: Session[],
  muscle: Muscle,
  from: number,
  to: number,
  resolve: Resolve,
  library: Map<string, LibraryExercise>,
): { exerciseId: string; name: string; sets: number }[] {
  const entries = sessions
    .filter((s) => s.deletedAt === undefined && s.startedAt >= from && s.startedAt < to)
    .flatMap((s) => s.entries)
  return contributors(entries, muscle, resolve, library)
}
