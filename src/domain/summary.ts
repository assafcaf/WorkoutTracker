import type { ExerciseRecord } from './records'
import type { Resolve } from './muscles'
import type { ExercisePlan, Session } from '../types'

export type SessionSummaryStats = {
  durationMs: number
  volumeKg: number
  bodyweightReps: number
  records: Array<{ exerciseId: string; name: string; records: ExerciseRecord[] }>
}

export function summarize(
  _session: Session,
  _earlier: Session[],
  _resolve: Resolve,
  _planFor: (exerciseId: string) => ExercisePlan | undefined,
): SessionSummaryStats {
  throw new Error('NotImplementedError: summarize')
}
