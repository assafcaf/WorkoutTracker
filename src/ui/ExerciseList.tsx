import type { Exercise, Program, Session, Workout } from '../types'

export type ExerciseListProps = {
  program: Program
  workout: Workout
  catalog: Map<string, Exercise>
  session: Session
  onOpenSet(exerciseId: string, setIndex: number): void
}

/**
 * The session's exercises, each with how many of its planned sets are logged, and a way into
 * the next set of one.
 *
 * STUB (E1-T7, red): renders nothing yet. The tests in ExerciseList.test.tsx say what it owes
 * -- one row per planned exercise, in plan order, each showing "logged/planned" -- and
 * App.test.tsx says how App routes into it.
 */
export function ExerciseList(_props: ExerciseListProps): JSX.Element {
  return <div className="exercise-list" />
}
