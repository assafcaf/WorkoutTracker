import type { Exercise, LibraryExercise, Program } from '../types'
import exercisesJson from './exercises.json'
import assafAb2026 from './programs/assaf-ab-2026.json'
import fullBodyStarter from './programs/full-body-starter.json'

// The bundled data files. JSON modules widen `repRange` to number[] and `units` to string, so
// each is asserted back to its declared shape here, once, rather than at every call site.
const seededExercises = exercisesJson as Exercise[]
const bundledPrograms = [assafAb2026, fullBodyStarter] as unknown as Program[]

/**
 * The exercise catalog, keyed by exercise id, read from `src/data/exercises.json`.
 */
export function loadCatalog(): Map<string, Exercise> {
  return new Map(seededExercises.map((exercise) => [exercise.id, exercise] as const))
}

/**
 * Every program under `src/data/programs/`, validated against the catalog.
 *
 * Throws an Error naming the program id and the missing exerciseId when a plan references an
 * exercise the catalog does not define. Defaults to `loadCatalog()` when no catalog is given.
 */
export function loadPrograms(_catalog?: Map<string, Exercise>): Program[] {
  const catalog = _catalog ?? loadCatalog()
  for (const program of bundledPrograms) assertPlansAreInCatalog(program, catalog)
  return bundledPrograms
}

/**
 * Throws on the first plan of `program` whose exerciseId the catalog does not define.
 */
export function assertPlansAreInCatalog(
  program: Program,
  catalog: Map<string, Exercise>,
): void {
  for (const workout of program.workouts) {
    for (const plan of workout.exercises) {
      if (!catalog.has(plan.exerciseId)) {
        throw new Error(
          `program ${program.id}, workout ${workout.id}: no exercise ${plan.exerciseId} in the catalog`,
        )
      }
    }
  }
}

/**
 * Throws on the first catalog exercise whose `libraryId` the library does not define.
 *
 * E5-T1 stub -- not implemented yet.
 */
export function assertCatalogInLibrary(
  _catalog: Map<string, Exercise>,
  _library: Map<string, LibraryExercise>,
): void {
  throw new Error('assertCatalogInLibrary is not implemented yet (E5-T1)')
}
