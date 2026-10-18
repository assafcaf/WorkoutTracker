import type { Exercise, LibraryExercise, Muscle, Program } from '../types'
import { familyOf, type MuscleFamily, type Resolve } from './muscles'

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

/** The four muscle families, in the order the Program tab draws and lists them. */
export const FAMILIES: readonly MuscleFamily[] = ['push', 'pull', 'legs', 'core']

/**
 * The family `exercise` trains: the family of its library entry's first primary muscle, or null
 * when the Exercise, its library entry or a primary muscle is missing.
 */
export function exerciseFamily(
  exercise: Exercise | undefined,
  library: Map<string, LibraryExercise>,
): MuscleFamily | null {
  if (!exercise) return null
  const primary = library.get(exercise.libraryId)?.primaryMuscles[0]
  return primary === undefined ? null : familyOf(primary)
}

/** A Program's planned Sets a week: all of them, and those of each muscle family. */
export type FamilyWeekly = { total: number; families: Record<MuscleFamily, number> }

/**
 * `program`'s planned weekly Sets by muscle family (Progress Dashboard S7a's "Weekly sets,
 * planned"): each visible Workout's Plans weigh `sessionsPerWeek / visible Workouts`, and every
 * Set counts once, toward the family of its Exercise (`exerciseFamily`). `total` counts every
 * planned Set, a Plan of no known family included. A count that is not a finite number -- a
 * half-typed field in the editor -- counts as 0.
 */
export function familyWeekly(
  program: Program,
  resolve: Resolve,
  library: Map<string, LibraryExercise>,
): FamilyWeekly {
  const families: Record<MuscleFamily, number> = { push: 0, pull: 0, legs: 0, core: 0 }
  const visible = program.workouts.filter((workout) => !workout.hidden)
  const weight = visible.length === 0 ? 0 : finite(program.sessionsPerWeek) / visible.length
  let total = 0
  for (const workout of visible) {
    for (const plan of workout.exercises) {
      const sets = finite(plan.sets) * weight
      total += sets
      const family = exerciseFamily(resolve(plan.exerciseId), library)
      if (family) families[family] += sets
    }
  }
  return { total, families }
}

/** One family's planned weekly Sets before and after an edit. */
export type FamilyImpact = { family: MuscleFamily; before: number; after: number }

/**
 * The muscle families whose planned weekly Sets (`familyWeekly`) differ between `before` and
 * `after`, in `FAMILIES` order -- what an edit in the Program editor does to the week (S7b).
 */
export function familyImpact(
  before: Program,
  after: Program,
  resolve: Resolve,
  library: Map<string, LibraryExercise>,
): FamilyImpact[] {
  const was = familyWeekly(before, resolve, library).families
  const now = familyWeekly(after, resolve, library).families
  return FAMILIES.filter((family) => Math.abs(was[family] - now[family]) > 1e-9).map((family) => ({
    family,
    before: was[family],
    after: now[family],
  }))
}

/** One Exercise's planned weekly Sets toward a set of muscles. */
export type PlannedContributor = { exerciseId: string; sets: number }

/**
 * The Exercises whose Plans count toward any of `muscles`, with their planned weekly Sets for
 * those muscles (`prescribedWeekly`'s rule), merged across Workouts, largest first.
 */
export function plannedContributors(
  program: Program,
  muscles: readonly Muscle[],
  catalog: Map<string, Exercise>,
  library: Map<string, LibraryExercise>,
): PlannedContributor[] {
  const weight = program.sessionsPerWeek / program.workouts.length
  const wanted = new Set<Muscle>(muscles)
  const byExercise = new Map<string, number>()

  for (const workout of program.workouts) {
    for (const plan of workout.exercises) {
      const exercise = catalog.get(plan.exerciseId)
      if (!exercise) continue
      const libraryExercise = library.get(exercise.libraryId)
      if (!libraryExercise) continue

      let share = 0
      for (const muscle of libraryExercise.primaryMuscles) if (wanted.has(muscle)) share += 1
      for (const muscle of libraryExercise.secondaryMuscles) if (wanted.has(muscle)) share += 0.5
      if (share === 0) continue
      byExercise.set(plan.exerciseId, (byExercise.get(plan.exerciseId) ?? 0) + plan.sets * weight * share)
    }
  }

  return [...byExercise]
    .map(([exerciseId, sets]) => ({ exerciseId, sets }))
    .sort((a, b) => b.sets - a.sets || (a.exerciseId < b.exerciseId ? -1 : a.exerciseId > b.exerciseId ? 1 : 0))
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0
}
