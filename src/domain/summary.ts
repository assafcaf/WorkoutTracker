import { recordsFor, type ExerciseRecord } from './records'
import type { Resolve } from './muscles'
import type { ExercisePlan, Session } from '../types'

export type SessionSummaryStats = {
  durationMs: number
  volumeKg: number
  bodyweightReps: number
  records: Array<{ exerciseId: string; name: string; records: ExerciseRecord[] }>
}

import { sessionVolume } from './volume'

export function summarize(
  session: Session,
  earlier: Session[],
  resolve: Resolve,
  planFor: (exerciseId: string) => ExercisePlan | undefined,
): SessionSummaryStats {
  const { kg, bodyweightReps } = sessionVolume(session, resolve)
  const records: SessionSummaryStats['records'] = []
  const seen = new Set<string>()

  for (const entry of session.entries) {
    const id = entry.exerciseId
    if (seen.has(id)) continue
    seen.add(id)

    const exercise = resolve(id)
    const plan = planFor(id)
    if (!exercise || !plan) continue
    if (!earlier.some((s) => s.entries.some((e) => e.exerciseId === id))) continue

    const before = recordsFor(exercise, plan, earlier)
    const changed = recordsFor(exercise, plan, [...earlier, session]).filter((after) => {
      const prev = before.find((r) => r.kind === after.kind)
      return !prev || prev.value !== after.value || prev.weightKg !== after.weightKg
    })
    if (changed.length > 0) records.push({ exerciseId: id, name: exercise.name, records: changed })
  }

  return {
    durationMs: (session.finishedAt ?? session.startedAt) - session.startedAt,
    volumeKg: kg,
    bodyweightReps,
    records,
  }
}
