import type { Exercise, ExercisePlan, Session } from '../types'

export type RecordKind =
  | 'heaviest-set'
  | 'best-e1rm'
  | 'most-reps-at-weight'
  | 'lowest-assistance'
  | 'most-reps-in-a-set'

export type ExerciseRecord = {
  kind: RecordKind
  label: string
  value: number
  weightKg: number | null
  reps: number
  at: number
}

export function recordsFor(
  _exercise: Exercise,
  _plan: ExercisePlan,
  _sessions: Session[],
): ExerciseRecord[] {
  throw new Error('not implemented')
}
