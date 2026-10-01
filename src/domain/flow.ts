import { countsTowardStats } from './setKind'
import type { Session, Workout } from '../types'

/**
 * The done id of the first Plan after `currentExerciseId`, in Plan order and wrapping to the
 * start, whose logged working Sets are fewer than its planned Sets -- warm-ups don't use up a
 * Plan (E14-T8); `null` when every Plan is done
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
    const logged = session.entries.filter(
      (entry) => entry.exerciseId === id && countsTowardStats(entry),
    ).length
    if (logged < plan.sets) return id
  }
  return null
}
