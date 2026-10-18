import type { ExercisePlan, Program, Session, Workout } from '../types'

export type SessionChange =
  | { kind: 'swap'; from: string; to: string }
  | { kind: 'add'; plan: ExercisePlan }
  | { kind: 'extend'; exerciseId: string; from: number; to: number }

export function sessionChanges(_session: Session, _workout: Workout): SessionChange[] {
  throw new Error('NotImplementedError')
}

export function applySessionChanges(
  _program: Program,
  _workoutId: string,
  _changes: SessionChange[],
): Program {
  throw new Error('NotImplementedError')
}
