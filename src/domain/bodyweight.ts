import type { Exercise } from '../types'

/**
 * Whether `exercise` is Bodyweight, with the trainee's override for its id applied: the override
 * when one is stored, else the Exercise's own `bodyweight` (E16-T1).
 *
 * STUB (E16-T1 test-designer): not implemented yet.
 */
export function bodyweightOf(exercise: Exercise, overrides: Record<string, boolean>): boolean {
  void exercise
  void overrides
  throw new Error('NotImplementedError: bodyweightOf')
}

/**
 * `exercise` with its `bodyweight` set to `bodyweightOf(exercise, overrides)`, everything else
 * unchanged (E16-T1).
 *
 * STUB (E16-T1 test-designer): not implemented yet.
 */
export function applyBodyweight(exercise: Exercise, overrides: Record<string, boolean>): Exercise {
  void exercise
  void overrides
  throw new Error('NotImplementedError: applyBodyweight')
}
