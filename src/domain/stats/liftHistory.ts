// E18-T3 [O4]: per-lift Session history (R-W working sets, R-L lever, R-T top set, R-E e1RM).
// Pure; imports only src/domain/** and src/types.ts.
//
// Exported contract (chosen by the test-designer, documented here and in the tests):
//   leverOf(set, bodyweight)                      -> R-L comparable weight (kg)
//   buildLiftHistories(sessions, resolve, planOf) -> Map<exerciseId, LiftHistory>
// `resolve` already applied Bodyweight (applyBodyweight); an Exercise it cannot resolve is
// skipped. `planOf` gives the active Program's ExercisePlan for an exercise id (for the R-E
// "Plan's top rep <= 10" test); undefined means no Plan and so no e1RM.
// A LiftHistory has one point per Session (ascending startedAt) that has at least one set of the
// lift; a Session with warm-ups only still yields a point whose workingSets is empty.
import type { ExercisePlan, Session, SetEntry } from '../../types'
import type { Resolve } from '../muscles'

export type LiftPoint = {
  sessionId: string
  startedAt: number
  deload: boolean
  /** R-W: every Set that is not a warm-up, in setIndex order (drop and failure included). */
  workingSets: SetEntry[]
  /** The warm-up Sets, in setIndex order. */
  warmups: SetEntry[]
  /** R-T: highest lever among straight sets and the most reps at that lever; null when none. */
  top: { lever: number; reps: number } | null
  /** R-E: unrounded Epley of the best straight set of <= 10 reps; null for a non-e1RM lift. */
  e1rm: number | null
}

export type LiftHistory = {
  exerciseId: string
  bodyweight: boolean
  /** R-E: not Bodyweight and its Plan's top rep <= 10. */
  e1rmLift: boolean
  points: LiftPoint[]
}

export type PlanOf = (exerciseId: string) => ExercisePlan | undefined

/** R-L: `weightKg` on a loaded Exercise; the signed `loadKg` on a Bodyweight one, `BW` as 0. */
export function leverOf(_set: Pick<SetEntry, 'weightKg' | 'loadKg'>, _bodyweight: boolean): number {
  throw new Error('NotImplementedError: leverOf')
}

export function buildLiftHistories(
  _sessions: Session[],
  _resolve: Resolve,
  _planOf: PlanOf,
): Map<string, LiftHistory> {
  throw new Error('NotImplementedError: buildLiftHistories')
}
