import type { LibraryExercise } from '../types'
import { LIBRARY_COMMIT } from './library'

/**
 * The photo URLs for `entry`, in `entry.images` order.
 *
 * `entry.images` already holds `<libraryId>/<n>.jpg` paths. When `entry.id` is one of the 14
 * catalog library ids (E5-T4's `public/library-photos/`), each path resolves to the bundled
 * local file under `base`; otherwise it resolves to the pinned free-exercise-db commit's copy
 * on raw.githubusercontent.com, since only the catalog's own exercises are bundled offline.
 */
export function photoUrls(
  entry: LibraryExercise,
  catalogLibraryIds: Set<string>,
  base: string,
): string[] {
  const isCatalog = catalogLibraryIds.has(entry.id)
  return entry.images.map((path) =>
    isCatalog
      ? `${base}library-photos/${path}`
      : `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${LIBRARY_COMMIT}/exercises/${path}`,
  )
}
