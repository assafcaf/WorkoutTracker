import { trainingFieldsFor } from '../domain/trainingFields'
import type { Exercise, LibraryExercise } from '../types'

/**
 * Resolves an id to the `Exercise` the dials, prefill and history can use: a catalog id
 * returns the catalog's `Exercise` as-is; an id not in the catalog but present in the library
 * is built from `trainingFieldsFor`, with `id` and `libraryId` both set to that library id and
 * the library entry's `name`. An id in neither map returns `undefined`.
 */
export function resolveExercise(
  id: string,
  catalog: Map<string, Exercise>,
  library: Map<string, LibraryExercise>,
): Exercise | undefined {
  const catalogExercise = catalog.get(id)
  if (catalogExercise) {
    return catalogExercise
  }

  const libraryEntry = library.get(id)
  if (libraryEntry) {
    return {
      id,
      libraryId: id,
      name: libraryEntry.name,
      ...trainingFieldsFor(libraryEntry),
    }
  }

  return undefined
}
