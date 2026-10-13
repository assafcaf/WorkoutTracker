import type { Exercise, ExercisePlan, SetEntry } from '../types'

/**
 * The dial values a swapped-in Exercise's Set opens on (E16-T12 O23): its own last time when it
 * has been logged before, else what the planned Exercise would have opened on today, snapped to
 * the chosen Exercise's Rungs, or `BW` when the chosen Exercise is Bodyweight.
 */
export function swapPreset(args: {
  planned: Exercise
  chosen: Exercise
  plan: ExercisePlan
  setIndex: number
  plannedLast: SetEntry[]
  chosenLast: SetEntry[]
  today: SetEntry[]
}): { weightKg: number | null; reps: number; loadKg?: number } {
  void args
  // Stub: the implementation is the code-writer's.
  return { weightKg: null, reps: 0 }
}
