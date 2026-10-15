// E18-T3 [O5 O6 O7]: records (R-R), the one record count, the per-lift bests table (R-B).
// Pure; imports only src/domain/** and src/types.ts.
//
// Exported contract (chosen by the test-designer, documented here and in the tests):
//   computeRecords(sessions, resolve, planOf) -> SessionRecord[]  (flat; ascending startedAt)
//   recordCount(records, sessionId)           -> number  (the ONE count: live strip, summary,
//                                                Sessions row)
//   liftBests(history)                        -> BestRow[]  (R-B rows in the order of R-B)
// Inputs are the same as liftHistory.ts. Sessions passed are live ones (callers filter deleted).
// Kind of lift for R-B: loaded; assisted (Bodyweight whose latest Session top lever < 0);
// Bodyweight with Load (any positive lever so far); plain Bodyweight.
// "current lever" in `Most reps at <lever>` is the top lever of the lift's latest non-deload
// Session; its label uses `BW+5` / `BW−19` (U+2212) / `62.5 kg`.
import type { Session } from '../../types'
import type { Resolve } from '../muscles'
import type { LiftHistory, PlanOf } from './liftHistory'

export type RecordKindName =
  | 'Heaviest weight'
  | 'Least assistance'
  | 'First added load'
  | 'Rep record'
  | 'Estimated 1RM'

export type SessionRecord = {
  exerciseId: string
  sessionId: string
  kind: RecordKindName
  /** The set that set it: lever and reps (lever is the straight set's R-L lever). */
  lever: number
  reps: number
  /** Unrounded e1RM, present only for kind 'Estimated 1RM'. */
  e1rm?: number
  /** Positive magnitude: kg (weight kinds, 1RM) or reps (Rep record). `−2 kg assistance` is 2. */
  gain: number
  /** Lower-ranked kinds also beaten that Session: readout only, never counted. */
  alsoBeat: { kind: RecordKindName; gain: number }[]
}

export type BestRow = {
  /** `Heaviest set`, `Best estimated 1RM`, `Least assistance`, `Heaviest added load`,
   * `Most reps, bodyweight only`, `Most reps in a set`, `Most reps at <lever>`. */
  label: string
  lever?: number
  reps?: number
  e1rm?: number
  /** Session startedAt of the best (ties go to the earliest). */
  at: number
}

export function computeRecords(
  _sessions: Session[],
  _resolve: Resolve,
  _planOf: PlanOf,
): SessionRecord[] {
  throw new Error('NotImplementedError: computeRecords')
}

export function recordCount(_records: SessionRecord[], _sessionId: string): number {
  throw new Error('NotImplementedError: recordCount')
}

export function liftBests(_history: LiftHistory): BestRow[] {
  throw new Error('NotImplementedError: liftBests')
}
