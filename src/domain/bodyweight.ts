import type { Exercise } from '../types'

/**
 * Whether `exercise` is Bodyweight, with the trainee's override for its id applied: the override
 * when one is stored, else the Exercise's own `bodyweight` (E16-T1).
 */
export function bodyweightOf(exercise: Exercise, overrides: Record<string, boolean>): boolean {
  return Object.prototype.hasOwnProperty.call(overrides, exercise.id)
    ? overrides[exercise.id]
    : exercise.bodyweight
}

/**
 * `exercise` with its `bodyweight` set to `bodyweightOf(exercise, overrides)`, everything else
 * unchanged (E16-T1).
 */
export function applyBodyweight(exercise: Exercise, overrides: Record<string, boolean>): Exercise {
  return { ...exercise, bodyweight: bodyweightOf(exercise, overrides) }
}
