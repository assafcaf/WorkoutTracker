import type { CustomExercise, Exercise, LibraryExercise } from '../types'

type Taken = { catalog: Map<string, Exercise>; library: Map<string, LibraryExercise> }

/**
 * null when `c` is valid, else a message: a blank name, no primary muscle, a weight step that is
 * not a finite number above 0, or an id equal to a catalog or library id (E19-T10, O17).
 */
export function validateCustomExercise(c: CustomExercise, taken: Taken): string | null {
  if (c.name.trim() === '') return 'A custom exercise needs a name.'
  if (c.primaryMuscles.length === 0) return 'A custom exercise needs a primary muscle.'
  if (!Number.isFinite(c.weightStep) || c.weightStep <= 0) return 'The weight step must be above 0.'
  if (taken.catalog.has(c.id) || taken.library.has(c.id)) return 'That id belongs to a bundled exercise.'
  return null
}

/**
 * New catalog and library maps with each valid custom Exercise added; invalid ones are dropped,
 * so a bundled entry with the same id stands. The inputs are untouched (E19-T10, O16, O17).
 */
export function mergeCustomExercises(
  custom: CustomExercise[],
  catalog: Map<string, Exercise>,
  library: Map<string, LibraryExercise>,
): Taken {
  const mergedCatalog = new Map(catalog)
  const mergedLibrary = new Map(library)
  for (const c of custom) {
    if (validateCustomExercise(c, { catalog, library }) !== null) continue
    mergedLibrary.set(c.id, {
      id: c.id,
      name: c.name,
      force: null,
      level: 'beginner',
      mechanic: null,
      equipment: c.equipment,
      primaryMuscles: c.primaryMuscles,
      secondaryMuscles: c.secondaryMuscles,
      instructions: [],
      category: 'strength',
      images: [],
    })
    mergedCatalog.set(c.id, {
      id: c.id,
      name: c.name,
      weightStep: c.weightStep,
      startWeight: null,
      bodyweight: c.bodyweight,
      libraryId: c.id,
    })
  }
  return { catalog: mergedCatalog, library: mergedLibrary }
}
