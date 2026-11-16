// v7 (study §1.8 and build-plan step 11): the Program tab's "Needs a decision": the lifts of the
// active Program whose one status (`liftStatuses`, status.ts) needs a decision -- Break, Slipping,
// Stalled, Lowered, Ready and Hold -- most pressing first, then in the Program's order. Every word
// comes from the status, so Program, Progress and the Lift page never disagree. Pure; imports only
// src/domain/** and src/types.ts.
import type { Program, Session } from '../types'
import type { Resolve } from './muscles'
import { liftStatuses } from './stats/status'
import type { LiftStatus, LiftStatusKind } from './stats/status'

const ORDER: Record<LiftStatusKind, number> = {
  break: 0,
  slipping: 1,
  stalled: 2,
  lowered: 3,
  ready: 4,
  hold: 5,
  moving: 6,
  'too new': 7,
}

/** The statuses that need a decision, for the lifts the Program's shown Workouts plan. */
export function programDecisions(program: Program, sessions: Session[], resolve: Resolve, now: number): LiftStatus[] {
  const planned: string[] = []
  for (const workout of program.workouts) {
    if (workout.hidden) continue
    for (const plan of workout.exercises) if (!planned.includes(plan.exerciseId)) planned.push(plan.exerciseId)
  }
  const statuses = liftStatuses(program, sessions, resolve, now)
  return planned
    .map((id) => statuses.get(id))
    .filter((status): status is LiftStatus => status !== undefined && status.decision)
    .sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || planned.indexOf(a.exerciseId) - planned.indexOf(b.exerciseId))
}
