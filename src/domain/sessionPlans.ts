import type { ExercisePlan, Session, Workout } from '../types'

/** The Workout's Plans, then the Plans added to `session` in the order added (E19-T12). */
export function sessionPlans(workout: Workout, session: Session): ExercisePlan[] {
  return [...workout.exercises, ...(session.added ?? [])]
}
