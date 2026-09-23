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
 */
export function prescribedWeekly(
  program: Program,
  catalog: Map<string, Exercise>,
  library: Map<string, LibraryExercise>,
): Map<Muscle, number> {
  const weight = program.sessionsPerWeek / program.workouts.length
  const counts = new Map<Muscle, number>()

  for (const workout of program.workouts) {
    for (const plan of workout.exercises) {
      const exercise = catalog.get(plan.exerciseId)
      if (!exercise) continue
      const libraryExercise = library.get(exercise.libraryId)
      if (!libraryExercise) continue

      const weightedSets = plan.sets * weight
      for (const muscle of libraryExercise.primaryMuscles) {
        counts.set(muscle, (counts.get(muscle) ?? 0) + weightedSets)
      }
      for (const muscle of libraryExercise.secondaryMuscles) {
        counts.set(muscle, (counts.get(muscle) ?? 0) + weightedSets * 0.5)
      }
    }
  }

  return counts
}

/**
 * The `TRACKED_MUSCLES` absent from `prescribed`, or present with zero prescribed sets.
 */
export function programGaps(prescribed: Map<Muscle, number>): Muscle[] {
  return TRACKED_MUSCLES.filter((muscle) => (prescribed.get(muscle) ?? 0) === 0)
}
