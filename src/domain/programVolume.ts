import type { Exercise, LibraryExercise, Muscle, Program } from '../types'

/**
 * The 12 major muscles this feature reports prescribed weekly volume and gaps for -- a subset
 * of the library's 17 muscles (excludes abductors, adductors, forearms, neck, traps; see
 * `.work/specs/2026-09-23-see-what-you-train.md` O4/M4).
 */
export const TRACKED_MUSCLES: readonly Muscle[] = [
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'chest',
  'lats',
  'middle back',
  'shoulders',
  'biceps',
  'triceps',
  'abdominals',
  'lower back',
]

/**
 * The prescribed weekly sets per muscle for `program`, averaged over its rotation: each
 * workout's plans count with weight `program.sessionsPerWeek / program.workouts.length`, then
 * the same 1-primary/0.5-secondary split `muscleSets` (`src/domain/muscles.ts`) applies per
 * set. A plan whose `exerciseId` is not in `catalog`, or whose resolved exercise's `libraryId`
 * is not in `library`, is skipped.
 *
 * STUB (E5-T13 test-designer): not implemented.
 */
export function prescribedWeekly(
  _program: Program,
  _catalog: Map<string, Exercise>,
  _library: Map<string, LibraryExercise>,
): Map<Muscle, number> {
  return new Map()
}

/**
 * The `TRACKED_MUSCLES` absent from `prescribed`, or present with zero prescribed sets.
 *
 * STUB (E5-T13 test-designer): not implemented.
 */
export function programGaps(_prescribed: Map<Muscle, number>): Muscle[] {
  return []
}
