import './ExerciseList.css'
import type { Exercise, ExercisePlan, Program, Session, SetEntry, Workout } from '../types'

export type ExerciseListProps = {
  program: Program
  workout: Workout
  /**
   * Resolves a catalog or library id to the `Exercise` it names (E5-T12). Replaces the earlier
   * `catalog: Map<string, Exercise>` prop: a swapped-in library id (`session.swaps`) is not in
   * the catalog, so a plain map lookup can no longer answer every row.
   */
  resolve(id: string): Exercise | undefined
  session: Session
  onOpenSet(exerciseId: string, setIndex: number): void
  /**
   * Finishes the session. The control is the shell's, in its sticky action bar, so the list
   * itself renders none: E3-T4 moved it out from under the rows.
   */
  onFinish(): void
  /**
   * The swap each plan carried in the last finished session of this workout (E5-T14), keyed
   * plannedId -> doneId, as `getLastSwap` answers it. A plan listed here and not swapped today
   * offers "Last time: <done exercise's name>".
   */
  lastSwaps: Record<string, string>
  /** Undoes today's swap of `plannedId` -- offered until the done exercise has a logged set. */
  onUndoSwap(plannedId: string): void
  /** Applies the "Last time" swap of `plannedId` for `doneId` to this session. */
  onApplySwap(plannedId: string, doneId: string): void
}

/** How many sets of this exercise the session already holds. */
function loggedSets(entries: SetEntry[], exerciseId: string): number {
  return entries.filter((entry) => entry.exerciseId === exerciseId).length
}

/**
 * The set a row opens: always the one after the last logged, even past the plan (E6-T10) -- an
 * exercise already at its planned count must not overwrite its last stored Set, so the row opens
 * one past it, landing on the set screen's done state (E6-T1) instead.
 */
export function nextSetIndex(logged: number, _plan: ExercisePlan): number {
  return logged + 1
}

/**
 * The session's exercises, each with how many of its planned sets are logged, and a way into
 * the next set of one.
 *
 * One button per planned exercise, in plan order; its accessible name leads with the
 * exercise's name, so the list is also the way back into a set.
 *
 * A plan swapped mid-session (`session.swaps`, E5-T11/E5-T12) reads instead as the done
 * exercise's name, "instead of" the planned one, with the plan's own sets, rep range and rest
 * -- and opens the *done* exercise's id, not the planned one.
 *
 * Beside a swapped row, "Undo swap" is offered until the done exercise's first set is logged
 * (E5-T14). An unswapped row whose plan was swapped last time (`lastSwaps`) offers
 * "Last time: <done exercise's name>", which applies the same swap.
 */
export function ExerciseList(props: ExerciseListProps): JSX.Element {
  const { workout, resolve, session, onOpenSet, lastSwaps, onUndoSwap, onApplySwap } = props

  return (
    <ul className="exercise-list">
      {workout.exercises.map((plan) => {
        const doneId = session.swaps?.[plan.exerciseId]
        const effectiveId = doneId ?? plan.exerciseId
        const exercise = resolve(effectiveId)
        const logged = loggedSets(session.entries, effectiveId)
        const lastDoneId = lastSwaps[plan.exerciseId]

        const label =
          doneId !== undefined ? (
            `${exercise?.name ?? doneId}, instead of ${resolve(plan.exerciseId)?.name ?? plan.exerciseId}, ${plan.sets} sets, ${plan.repRange[0]}-${plan.repRange[1]} reps, ${plan.restSeconds}s rest`
          ) : (
            <>
              <span className="exercise-name">{exercise?.name ?? plan.exerciseId}</span>{' '}
              <span className="set-progress">{`${logged}/${plan.sets}`}</span>
            </>
          )

        return (
          <li key={plan.exerciseId}>
            <button
              type="button"
              className="exercise-row"
              onClick={() => onOpenSet(effectiveId, nextSetIndex(logged, plan))}
            >
              {label}
            </button>
            {doneId !== undefined && logged === 0 ? (
              <button
                type="button"
                className="exercise-undo-swap"
                onClick={() => onUndoSwap(plan.exerciseId)}
              >
                Undo swap
              </button>
            ) : null}
            {doneId === undefined && lastDoneId !== undefined ? (
              <button
                type="button"
                className="exercise-last-time"
                onClick={() => onApplySwap(plan.exerciseId, lastDoneId)}
              >
                {`Last time: ${resolve(lastDoneId)?.name ?? lastDoneId}`}
              </button>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
