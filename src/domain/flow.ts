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
  const plans = workout.exercises
  const swaps = session.swaps ?? {}
  const doneId = (plannedId: string): string => swaps[plannedId] ?? plannedId
  const current = plans.findIndex(
    (plan) => plan.exerciseId === currentExerciseId || doneId(plan.exerciseId) === currentExerciseId,
  )
  for (let step = 1; step <= plans.length; step += 1) {
    const plan = plans[(current + step + plans.length) % plans.length]
    const id = doneId(plan.exerciseId)
    const logged = session.entries.filter((entry) => entry.exerciseId === id).length
    if (logged < plan.sets) return id
  }
  return null
}
