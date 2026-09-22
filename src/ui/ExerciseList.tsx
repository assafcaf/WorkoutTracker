import type { Exercise, ExercisePlan, Program, Session, SetEntry, Workout } from '../types'

export type ExerciseListProps = {
  program: Program
  workout: Workout
  catalog: Map<string, Exercise>
  session: Session
  onOpenSet(exerciseId: string, setIndex: number): void
}

/** How many sets of this exercise the session already holds. */
function loggedSets(entries: SetEntry[], exerciseId: string): number {
  return entries.filter((entry) => entry.exerciseId === exerciseId).length
}

/**
 * The set a row opens: the one after the last logged, never past the plan -- an exercise
 * already at its planned count re-opens its last set, since a set past the plan is what the
 * set screen's "Add set" is for.
 */
function nextSetIndex(logged: number, plan: ExercisePlan): number {
  return Math.min(logged + 1, plan.sets)
}

/**
 * The session's exercises, each with how many of its planned sets are logged, and a way into
 * the next set of one.
 *
 * One button per planned exercise, in plan order; its accessible name leads with the
 * exercise's name, so the list is also the way back into a set.
 */
export function ExerciseList(props: ExerciseListProps): JSX.Element {
  const { workout, catalog, session, onOpenSet } = props

  return (
    <ul className="exercise-list">
      {workout.exercises.map((plan) => {
        const exercise = catalog.get(plan.exerciseId)
        const logged = loggedSets(session.entries, plan.exerciseId)
        return (
          <li key={plan.exerciseId}>
            <button
              type="button"
              className="exercise-row"
              onClick={() => onOpenSet(plan.exerciseId, nextSetIndex(logged, plan))}
            >
              <span className="exercise-name">{exercise?.name ?? plan.exerciseId}</span>{' '}
              <span className="set-progress">{`${logged}/${plan.sets}`}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
