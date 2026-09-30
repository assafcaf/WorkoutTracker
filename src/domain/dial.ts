import type { Exercise } from '../types'

/** The weight-step choices offered by the set screen's step control (E8-T8). */
export const WEIGHT_STEPS = [0.5, 1, 1.25, 2.5, 5, 10]

const MIN_WEIGHT_KG = 0
const MAX_WEIGHT_KG = 500
const MIN_REPS = 0.5
const MAX_REPS = 100
const MIN_LOAD_KG = -60
const MAX_LOAD_KG = 100

// Round to a small number of decimal places to avoid floating-point drift (e.g. 7.5 + 1.25
// coming out as 8.750000000000002) when stepping repeatedly by fractional weightStep values.
function roundToStep(value: number): number {
  return Math.round(value * 1000) / 1000
}

/**
 * The exercise's weight ladder: every valid weight in kg from its start weight upward, stepping
 * by its weightStep, inclusive of the accepted maximum (see validateEntry).
 *
 * A bodyweight exercise (startWeight: null) has no numeric ladder and returns [].
 */
export function buildLadder(exercise: Exercise): number[] {
  if (exercise.startWeight === null) return []

  const ladder: number[] = []
  for (let value = exercise.weightStep; value <= MAX_WEIGHT_KG; value = roundToStep(value + exercise.weightStep)) {
    ladder.push(value)
  }
  return ladder
}

/**
 * Steps `value` one notch along `exercise`'s ladder in `dir`. A value already on the ladder
 * moves to the adjacent rung; a value off the ladder is first snapped down to the nearest rung
 * at or below it, then that rung is stepped by one position in `dir`.
 */
export function stepWeight(value: number, dir: 1 | -1, exercise: Exercise): number {
  const ladder = buildLadder(exercise)
  if (ladder.length === 0) return value

  let floorIndex = -1
  for (let i = 0; i < ladder.length; i++) {
    if (ladder[i] <= value) floorIndex = i
    else break
  }

  const newIndex = floorIndex + dir
  if (newIndex < 0) return ladder[0]
  if (newIndex >= ladder.length) return ladder[ladder.length - 1]
  return ladder[newIndex]
}

export type EntryValidation = { ok: true } | { ok: false; error: string }

/**
 * The Load Dial's Rungs for a Bodyweight Exercise (E14-T14): every signed load in kg from -60 to
 * +100 inclusive, `step` apart, with 0 (plain bodyweight) among them.
 */
export function loadLadder(step: number): number[] {
  const below: number[] = []
  for (let k = 1; roundToStep(-k * step) >= MIN_LOAD_KG; k++) below.unshift(roundToStep(-k * step))
  const above: number[] = []
  for (let k = 0; roundToStep(k * step) <= MAX_LOAD_KG; k++) above.push(roundToStep(k * step))
  return [...below, ...above]
}

/**
 * Validates a logged set's weight and reps. Weight must be null (bodyweight) or within
 * 0-500 kg inclusive; reps must be within 0.5-100 inclusive; a Bodyweight Set's `loadKg`, when
 * given, must be within -60 to +100 kg inclusive (E14-T14).
 */
export function validateEntry(
  weightKg: number | null,
  reps: number,
  loadKg?: number,
): EntryValidation {
  if (weightKg !== null && (weightKg < MIN_WEIGHT_KG || weightKg > MAX_WEIGHT_KG)) {
    return { ok: false, error: `Weight must be between ${MIN_WEIGHT_KG} and ${MAX_WEIGHT_KG} kg.` }
  }

  if (reps < MIN_REPS || reps > MAX_REPS) {
    return { ok: false, error: `Reps must be between ${MIN_REPS} and ${MAX_REPS}.` }
  }

  if (loadKg !== undefined && (loadKg < MIN_LOAD_KG || loadKg > MAX_LOAD_KG)) {
    return { ok: false, error: `Load must be between ${MIN_LOAD_KG} and +${MAX_LOAD_KG} kg.` }
  }

  return { ok: true }
}
