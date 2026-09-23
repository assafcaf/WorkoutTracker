import type { LibraryExercise, Muscle } from '../types'

/**
 * The free-exercise-db commit `src/data/library/exercises.json` is pinned to. Also used to
 * build the raw.githubusercontent.com photo URL for a non-catalog exercise (E5-T4+).
 */
export const LIBRARY_COMMIT = 'a859101d633a01c4a1a920d6a8ce41dabba0705f'

/** The 17 muscle names free-exercise-db uses, in dataset order. */
export const MUSCLES: readonly Muscle[] = [
  'abdominals',
  'abductors',
  'adductors',
  'biceps',
  'calves',
  'chest',
  'forearms',
  'glutes',
  'hamstrings',
  'lats',
  'lower back',
  'middle back',
  'neck',
  'quadriceps',
  'shoulders',
  'traps',
  'triceps',
]

/**
 * The bundled free-exercise-db library, keyed by its `id` (a catalog exercise's `libraryId`).
 *
 * Loads `src/data/library/exercises.json` with a dynamic `import()`, so the ~1 MB dataset gets
 * its own chunk instead of landing in the Workout tab's start-up bundle.
 *
 * E5-T1 stub -- not implemented yet.
 */
export async function loadLibrary(): Promise<Map<string, LibraryExercise>> {
  throw new Error('loadLibrary is not implemented yet (E5-T1)')
}
