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

/** Movement families whose library names are reliable: a lift's family-mates can stand in for it. */
const FAMILIES = ['deadlift', 'squat', 'row', 'curl', 'lunge']

/** Band and chain variants: a gym rarely has them set up, so they come last. */
const BANDS = /\bbands?\b/i
const CHAINS = /\bchains?\b/i

/** The name's words, lower case, a plural `s` dropped: "Romanian Deadlifts" -> romanian, deadlift. */
function wordsOf(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => word !== '')
    .map((word) => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word))
}

/**
 * V6-10: the swap list for `target` when its station is taken, best first:
 *   0. lifts the lifter has logged (`logged`, library ids);
 *   1. the same primary muscle on the same equipment;
 *   2. the lift's own family on the same equipment (a Romanian deadlift for a deadlift), even
 *      with another primary muscle;
 *   3. the rest of `alternativesFor`'s list, then the family on other equipment;
 *   4. band and chain variants (bands rank with the rest when the gym has bands).
 * `gymEquipment` filters every candidate as `alternativesFor` does. Ties keep `alternativesFor`'s
 * order (an expert-level lift last in its tier), family-only candidates after it by name.
 */
export function swapAlternatives(
  target: LibraryExercise,
  library: Map<string, LibraryExercise>,
  gymEquipment: string[] | null,
  logged: ReadonlySet<string> = new Set(),
): LibraryExercise[] {
  const ranked = alternativesFor(target, library, gymEquipment)
  const family = FAMILIES.find((word) => wordsOf(target.name).includes(word)) ?? null
  const inFamily = (candidate: LibraryExercise): boolean => family !== null && wordsOf(candidate.name).includes(family)
  const allowed = (candidate: LibraryExercise): boolean =>
    gymEquipment === null ||
    candidate.equipment === null ||
    candidate.equipment === 'body only' ||
    gymEquipment.includes(candidate.equipment)
  const seen = new Set(ranked.map((candidate) => candidate.id))
  const extras = Array.from(library.values())
    .filter((candidate) => candidate.id !== target.id && !seen.has(candidate.id))
    .filter((candidate) => candidate.category === 'strength' || candidate.category === 'powerlifting')
    .filter((candidate) => inFamily(candidate) && allowed(candidate))
    .sort((a, b) => a.name.localeCompare(b.name))
  const hasBands = gymEquipment?.includes('bands') === true
  const expert = (candidate: LibraryExercise): number => (candidate.level === 'expert' ? 1 : 0)
  const tier = (candidate: LibraryExercise): number => {
    if (logged.has(candidate.id)) return 0
    if (CHAINS.test(candidate.name) || (!hasBands && BANDS.test(candidate.name))) return 4
    const sameEquipment = candidate.equipment === target.equipment
    if (sameEquipment && candidate.primaryMuscles.some((muscle) => target.primaryMuscles.includes(muscle))) return 1
    if (sameEquipment && inFamily(candidate)) return 2
    return 3
  }
  return [...ranked, ...extras]
    .map((candidate, index) => ({ candidate, index, tier: tier(candidate) }))
    // Within a tier an expert-level lift (One-Arm Side Deadlift) is a poor stand-in: it goes last.
    .sort((a, b) => a.tier - b.tier || expert(a.candidate) - expert(b.candidate) || a.index - b.index)
    .map(({ candidate }) => candidate)
}
