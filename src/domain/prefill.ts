import type { Exercise, ExercisePlan, SetEntry } from '../types'

/**
 * The dial values a set should open with, derived from the last finished session that
 * contained this exercise.
 *
 * `setIndex` is 1-based. `lastEntries` are the entries for this exercise from the last
 * finished session that contained it, in `setIndex` order -- the caller supplies them
 * (E1-T3's `getLastEntriesFor`), so this function stays pure and does no storage access.
 *
 * Rules, in order:
 * - an exact match on `setIndex` wins;
 * - no exact match but entries exist -> the entry with the highest `setIndex`;
 * - no entries -> `exercise.startWeight` and `plan.repRange[0]`.
 *
 * A bodyweight exercise always yields `weightKg: null`.
 */
export function presetForSet(_args: {
  exercise: Exercise
  plan: ExercisePlan
  setIndex: number
  lastEntries: SetEntry[]
}): { weightKg: number | null; reps: number } {
  throw new Error('not implemented')
}
