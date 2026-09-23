import type { Exercise, LibraryExercise } from '../types'

/**
 * Resolves an id to the `Exercise` the dials, prefill and history can use: a catalog id
 * returns the catalog's `Exercise` as-is; an id not in the catalog but present in the library
 * is built from `trainingFieldsFor`, with `id` and `libraryId` both set to that library id, the
 * library entry's `name`, and `infoUrl` left as an empty-string placeholder (E5-T8 removes
 * `infoUrl` from `Exercise`). An id in neither map returns `undefined`.
 */
export function resolveExercise(
  _id: string,
  _catalog: Map<string, Exercise>,
  _library: Map<string, LibraryExercise>,
): Exercise | undefined {
  throw new Error('not implemented')
}
