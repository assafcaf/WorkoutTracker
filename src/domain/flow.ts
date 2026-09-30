import type { Session, Workout } from '../types'

/**
 * The done id of the first Plan after `currentExerciseId`, in Plan order and wrapping to the
 * start, whose logged Sets are fewer than its planned Sets; `null` when every Plan is done
 * (E13-T12).
 */
export function nextExerciseAfter(
  workout: Workout,
  session: Session,
  currentExerciseId: string,
): string | null {
  void workout
  void session
  // Stub: to be implemented; answers the current id so every test fails on its assertion.
  return currentExerciseId
}
