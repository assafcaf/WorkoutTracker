// E18-T5 [O24 engine half]: Train's due workout with each lift's next step and a duration estimate.
// Pure; imports only src/domain/** and src/types.ts.
//
// Exported contract (chosen by the test-designer, documented here and in the tests):
//   dueWorkoutCard(program, sessions, resolve, histories) -> DueWorkoutCard | null
// The due workout is the one `dueWorkout` (dashboard.ts) picks. `lifts` follow the Plan order;
// an Exercise `resolve` cannot resolve is skipped. `minutes` is the median of the workout's last
// logged durations (finished Sessions of this Program and workout, at most the last 5) rounded to
// whole minutes when there are 3 or more, else the plan estimate `workoutEstimate(...).minutes`.
import type { Program, Session, Workout } from '../../types'
import type { Resolve } from '../muscles'
import type { LiftHistory } from './liftHistory'
import type { NextStep } from './verdict'

export type TrainLift = { exerciseId: string; name: string; step: NextStep | null }

export type DueWorkoutCard = {
  workout: Workout
  lastDoneAt: number | null
  lifts: TrainLift[]
  minutes: number
  /** 'logged' when `minutes` comes from logged durations, else 'plan'. */
  estimate: 'logged' | 'plan'
}

export function dueWorkoutCard(
  _program: Program,
  _sessions: Session[],
  _resolve: Resolve,
  _histories: Map<string, LiftHistory>,
): DueWorkoutCard | null {
  throw new Error('not implemented')
}
