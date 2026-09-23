import type { LibraryExercise, Muscle, Video } from '../types'

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
 */
export async function loadLibrary(): Promise<Map<string, LibraryExercise>> {
  const { default: entries } = await import('./library/exercises.json')
  const library = entries as unknown as LibraryExercise[]
  return new Map(library.map((exercise) => [exercise.id, exercise] as const))
}

/**
 * The harvested Muscle & Strength videos, keyed by library id (E5-T7).
 *
 * Loads `src/data/library/videos.json` (built by `scripts/build-videos.ts`) with a dynamic
 * `import()`, the same chunking rationale as `loadLibrary()`.
 *
 * STUB (E5-T7 test-designer): `videos.json` is a placeholder `{}` until the code-writer runs
 * the real build, so this currently always resolves to an empty map.
 */
export async function loadVideos(): Promise<Map<string, Video>> {
  const { default: entries } = await import('./library/videos.json')
  const videos = entries as unknown as Record<string, Video>
  return new Map(Object.entries(videos))
}
