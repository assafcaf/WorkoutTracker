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
import { countsTowardStats } from '../setKind'

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
export function leverOf(set: Pick<SetEntry, 'weightKg' | 'loadKg'>, bodyweight: boolean): number {
  return bodyweight ? (set.loadKg ?? 0) : (set.weightKg ?? 0)
}

/** Straight sets (R-W): working Sets that are not drop Sets. Only these set records and tops. */
export function straightSets(sets: SetEntry[]): SetEntry[] {
  return sets.filter((s) => s.kind !== 'drop')
}

export function buildLiftHistories(
  sessions: Session[],
  resolve: Resolve,
  planOf: PlanOf,
): Map<string, LiftHistory> {
  const out = new Map<string, LiftHistory>()
  const ordered = [...sessions].sort((a, b) => a.startedAt - b.startedAt)
  for (const session of ordered) {
    const byLift = new Map<string, SetEntry[]>()
    for (const e of session.entries) {
      const list = byLift.get(e.exerciseId)
      if (list) list.push(e)
      else byLift.set(e.exerciseId, [e])
    }
    for (const [exerciseId, entries] of byLift) {
      const exercise = resolve(exerciseId)
      if (!exercise) continue
      let history = out.get(exerciseId)
      if (!history) {
        const plan = planOf(exerciseId)
        history = {
          exerciseId,
          bodyweight: exercise.bodyweight,
          e1rmLift: !exercise.bodyweight && plan !== undefined && plan.repRange[1] <= 10,
          points: [],
        }
        out.set(exerciseId, history)
      }
      const sorted = [...entries].sort((a, b) => a.setIndex - b.setIndex)
      const workingSets = sorted.filter(countsTowardStats)
      const warmups = sorted.filter((s) => !countsTowardStats(s))
      let top: LiftPoint['top'] = null
      let e1rm: number | null = null
      for (const s of straightSets(workingSets)) {
        const lever = leverOf(s, history.bodyweight)
        if (!top || lever > top.lever || (lever === top.lever && s.reps > top.reps)) {
          top = { lever, reps: s.reps }
        }
        if (history.e1rmLift && s.reps <= 10) {
          const est = lever * (1 + s.reps / 30)
          if (e1rm === null || est > e1rm) e1rm = est
        }
      }
      history.points.push({
        sessionId: session.id,
        startedAt: session.startedAt,
        deload: session.deload === true,
        workingSets,
        warmups,
        top,
        e1rm,
      })
    }
  }
  return out
}
