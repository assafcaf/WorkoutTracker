// E18-T5 [O8 O9 O10]: verdicts (R-V), next step (R-N), steps climbed (R-S).
// Pure; imports only src/domain/** and src/types.ts.
//
// Exported contract (chosen by the test-designer, documented here and in the tests):
//   verdictOf(history, records, now)        -> Verdict   (one lift; deload Sessions skipped)
//   verdicts(histories, records, now)       -> Map<exerciseId, Verdict>
//   nextStep(history, plan, exercise)       -> NextStep | null
//   stepsClimbed(histories, records, now)   -> StepsClimbed
// `records` is computeRecords(...) output (all lifts). `now` is epoch ms; "today" is its local day.
import type { Exercise, ExercisePlan } from '../../types'
import type { LiftHistory } from './liftHistory'
import type { SessionRecord } from './records'

export type VerdictKind = 'moving' | 'stalled' | 'slipping' | 'too new'

export type Verdict = {
  kind: VerdictKind
  /** Non-deload Sessions of the lift. */
  n: number
  /** 'too new' only: `4 - n`. */
  more?: number
  /** 'stalled' only: startedAt of the last record's Session, or of the baseline when none. */
  since?: number
  /** 'stalled' only: non-deload Sessions after `since`. */
  sessionsSince?: number
  /** 'stalled' only: unrounded weeks from `since` to `now`. */
  weeks?: number
  /** 'slipping' only: the best top set of the Sessions before the last 2, and its Session's startedAt. */
  bestBefore?: { lever: number; reps: number; startedAt: number }
}

export type NextStep = {
  /** Reps done in the latest Session's straight sets at its top lever. */
  repsAtTop: number
  /** Plan sets x top of the Plan's rep range. */
  target: number
  /** The latest Session's top lever (R-L). */
  lever: number
  ready: boolean
  /** Only when ready: one step up in lever, or one more set for a plain Bodyweight lift. */
  suggest?: { kind: 'lever'; lever: number } | { kind: 'set' }
}

export type StepsClimbed = {
  climbed: number
  /** Lifts with a history. */
  of: number
  /** Local midnight of the first of the 28 days ending today. */
  since: number
  /** The lifts that climbed, sorted. */
  ids: string[]
}

export function verdictOf(_history: LiftHistory, _records: SessionRecord[], _now: number): Verdict {
  throw new Error('not implemented')
}

export function verdicts(
  _histories: Map<string, LiftHistory>,
  _records: SessionRecord[],
  _now: number,
): Map<string, Verdict> {
  throw new Error('not implemented')
}

export function nextStep(
  _history: LiftHistory,
  _plan: ExercisePlan | undefined,
  _exercise: Exercise,
): NextStep | null {
  throw new Error('not implemented')
}

export function stepsClimbed(
  _histories: Map<string, LiftHistory>,
  _records: SessionRecord[],
  _now: number,
): StepsClimbed {
  throw new Error('not implemented')
}
