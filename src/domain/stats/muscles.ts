import type { LibraryExercise, Muscle, Program, Session } from '../../types'
import type { Resolve } from '../muscles'

/** The 12 muscles of R-M, in the order the table shows them. */
export const STATS_MUSCLES: readonly Muscle[] = []

/** One calendar week's sets per muscle (all 14 counted muscles, 0 when untrained). */
export type MuscleWeek = { start: number; inProgress: boolean; sets: Map<Muscle, number> }

/** Done so far this week and what the rotation still owes (R-M). */
export type ThisWeekMuscle = { done: number; stillPlanned: number }

/** Working sets per muscle for every R-K week, oldest first, empty weeks included. */
export function muscleWeeks(
  _sessions: Session[],
  _now: number,
  _resolve: Resolve,
  _library: Map<string, LibraryExercise>,
): MuscleWeek[] {
  return []
}

/** Planned sets per week: plan sets x `sessionsPerWeek / workouts`, 1 primary, 0.5 secondary. */
export function plannedPerWeek(
  _program: Program,
  _resolve: Resolve,
  _library: Map<string, LibraryExercise>,
): Map<Muscle, number> {
  return new Map()
}

/** The average of the last `weeks` (default 2) complete weeks' sets per muscle. */
export function windowAverage(
  _sessions: Session[],
  _now: number,
  _resolve: Resolve,
  _library: Map<string, LibraryExercise>,
  _weeks?: number,
): Map<Muscle, number> {
  return new Map()
}

/** Per muscle: done so far this week, plus the Plan sets of the workouts still owed. */
export function thisWeekMuscles(
  _sessions: Session[],
  _program: Program,
  _now: number,
  _resolve: Resolve,
  _library: Map<string, LibraryExercise>,
): Map<Muscle, ThisWeekMuscle> {
  return new Map()
}

/**
 * Each lift's exact fractional working sets toward `muscle` in Sessions started in
 * `[from, to)`. The sets sum to the muscle's total.
 */
export function muscleContributors(
  _sessions: Session[],
  _muscle: Muscle,
  _from: number,
  _to: number,
  _resolve: Resolve,
  _library: Map<string, LibraryExercise>,
): { exerciseId: string; name: string; sets: number }[] {
  return []
}
