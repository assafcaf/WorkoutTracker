import type { LibraryExercise } from '../types'

/**
 * The ranked list of library exercises that can stand in for `target`, limited to what the
 * gym has.
 *
 * A candidate qualifies when it shares at least one of `target`'s `primaryMuscles`, its
 * `category` is `strength` or `powerlifting`, and it is not `target` itself. `gymEquipment`
 * further limits candidates to those whose `equipment` is `null` or is included in the list;
 * `null` means no equipment filter (every equipment value is allowed).
 *
 * Ranked: `target.mechanic` matches first, then by the count of `secondaryMuscles` shared with
 * `target` (most first), then by `name` A→Z.
 *
 * E5-T5 stub -- not yet implemented.
 */
export function alternativesFor(
  target: LibraryExercise,
  library: Map<string, LibraryExercise>,
  gymEquipment: string[] | null,
): LibraryExercise[] {
  throw new Error('not implemented')
}
