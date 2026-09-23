import type { Exercise, LibraryExercise } from '../types'

/**
 * The training defaults a library entry gets when a catalog exercise does not override them:
 * `weightStep` from its equipment (barbell/cable 2.5, dumbbell 1, machine 5, kettlebells 4,
 * anything else 1), `bodyweight`/`startWeight` from whether it needs no equipment
 * ("body only" -> bodyweight true, no start weight; anything else -> bodyweight false, starting
 * at 0), and `invertProgress` always false (only the catalog's assisted-pull-ups inverts, and
 * that is not derived from the library).
 */
const WEIGHT_STEP_BY_EQUIPMENT: Record<string, number> = {
  barbell: 2.5,
  dumbbell: 1,
  cable: 2.5,
  machine: 5,
  kettlebells: 4,
}

export function trainingFieldsFor(
  entry: LibraryExercise,
): Pick<Exercise, 'weightStep' | 'startWeight' | 'bodyweight' | 'invertProgress'> {
  const bodyweight = entry.equipment === 'body only'

  return {
    weightStep: entry.equipment ? (WEIGHT_STEP_BY_EQUIPMENT[entry.equipment] ?? 1) : 1,
    startWeight: bodyweight ? null : 0,
    bodyweight,
    invertProgress: false,
  }
}
