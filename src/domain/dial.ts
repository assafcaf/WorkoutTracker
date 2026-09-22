import type { Exercise } from '../types'

/**
 * The exercise's weight ladder: every valid weight in kg from its start weight upward, stepping
 * by its weightStep, inclusive of the accepted maximum (see validateEntry).
 *
 * A bodyweight exercise (startWeight: null) has no numeric ladder and returns [].
 */
export function buildLadder(_exercise: Exercise): number[] {
  throw new Error('not implemented')
}

/**
 * Steps `value` one notch along `exercise`'s ladder in `dir`. A value already on the ladder
 * moves to the adjacent rung; a value off the ladder moves to the next rung in `dir`.
 */
export function stepWeight(_value: number, _dir: 1 | -1, _exercise: Exercise): number {
  throw new Error('not implemented')
}

export type EntryValidation = { ok: true } | { ok: false; error: string }

/**
 * Validates a logged set's weight and reps. Weight must be null (bodyweight) or within
 * 0-500 kg inclusive; reps must be within 0.5-100 inclusive.
 */
export function validateEntry(_weightKg: number | null, _reps: number): EntryValidation {
  throw new Error('not implemented')
}
