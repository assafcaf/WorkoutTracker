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
  const sharesPrimaryMuscle = (candidate: LibraryExercise): boolean =>
    candidate.primaryMuscles.some((muscle) => target.primaryMuscles.includes(muscle))

  const passesEquipment = (candidate: LibraryExercise): boolean => {
    if (gymEquipment === null) return true
    if (candidate.equipment === null || candidate.equipment === 'body only') return true
    return gymEquipment.includes(candidate.equipment)
  }

  const sharedSecondaryMuscleCount = (candidate: LibraryExercise): number =>
    candidate.secondaryMuscles.filter((muscle) => target.secondaryMuscles.includes(muscle)).length

  return Array.from(library.values())
    .filter((candidate) => candidate.id !== target.id)
    .filter((candidate) => candidate.category === 'strength' || candidate.category === 'powerlifting')
    .filter(sharesPrimaryMuscle)
    .filter(passesEquipment)
    .sort((a, b) => {
      const aMechanicMatches = a.mechanic === target.mechanic
      const bMechanicMatches = b.mechanic === target.mechanic
      if (aMechanicMatches !== bMechanicMatches) return aMechanicMatches ? -1 : 1

      const secondaryDiff = sharedSecondaryMuscleCount(b) - sharedSecondaryMuscleCount(a)
      if (secondaryDiff !== 0) return secondaryDiff

      return a.name.localeCompare(b.name)
    })
}
