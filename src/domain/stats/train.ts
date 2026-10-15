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
import { dueWorkout, workoutEstimate } from '../dashboard'
import type { Resolve } from '../muscles'
import type { LiftHistory } from './liftHistory'
import { nextStep } from './verdict'
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

const MIN_MS = 60_000
const LOGGED_MIN = 3
const LOGGED_MAX = 5

function median(values: number[]): number {
  const v = [...values].sort((a, b) => a - b)
  const mid = v.length >> 1
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
}

export function dueWorkoutCard(
  program: Program,
  sessions: Session[],
  resolve: Resolve,
  histories: Map<string, LiftHistory>,
): DueWorkoutCard | null {
  const due = dueWorkout(program, sessions)
  if (!due) return null
  const { workout, lastDoneAt } = due

  const lifts: TrainLift[] = []
  for (const plan of workout.exercises) {
    const exercise = resolve(plan.exerciseId)
    if (!exercise) continue
    const history = histories.get(plan.exerciseId)
    lifts.push({
      exerciseId: plan.exerciseId,
      name: exercise.name,
      step: history ? nextStep(history, plan, exercise) : null,
    })
  }

  const durations = sessions
    .filter((s) => s.programId === program.id && s.workoutId === workout.id && s.finishedAt != null)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, LOGGED_MAX)
    .map((s) => (s.finishedAt! - s.startedAt) / MIN_MS)
  if (durations.length >= LOGGED_MIN) {
    return { workout, lastDoneAt, lifts, minutes: Math.round(median(durations)), estimate: 'logged' }
  }
  return { workout, lastDoneAt, lifts, minutes: workoutEstimate(workout).minutes, estimate: 'plan' }
}
