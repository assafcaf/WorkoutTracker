import type { CustomExercise, Exercise, LibraryExercise } from '../types'

type Taken = { catalog: Map<string, Exercise>; library: Map<string, LibraryExercise> }

/**
 * null when `c` is valid, else a message: a blank name, no primary muscle, a weight step that is
 * not a finite number above 0, or an id equal to a catalog or library id (E19-T10, O17).
 *
 * STUB (E19-T10 test-designer): not implemented yet.
 */
export function validateCustomExercise(_c: CustomExercise, _taken: Taken): string | null {
  throw new Error('not implemented')
}

/**
 * New catalog and library maps with each valid custom Exercise added; invalid ones are dropped,
 * so a bundled entry with the same id stands. The inputs are untouched (E19-T10, O16, O17).
 *
 * STUB (E19-T10 test-designer): not implemented yet.
 */
export function mergeCustomExercises(
  _custom: CustomExercise[],
  _catalog: Map<string, Exercise>,
  _library: Map<string, LibraryExercise>,
): Taken {
  throw new Error('not implemented')
}
