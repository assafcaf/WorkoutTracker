import type { Exercise, Session } from '../types'
import { countsTowardStats } from './setKind'

export type SeriesKind = 'e1rm' | 'reps' | 'load'
export type SeriesPoint = { at: number; value: number }
export type Series = { kind: SeriesKind; points: SeriesPoint[] }

export function epley(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30)
}

/**
 * A loaded Exercise charts its e1RM. A Bodyweight one charts its signed Load (the highest per
 * Session, so less assistance reads higher) once any counted Set carries a Load, else its reps.
 */
function seriesKind(exercise: Exercise, sessions: Session[]): SeriesKind {
  if (!exercise.bodyweight) return 'e1rm'
  const loaded = sessions.some((session) =>
    session.entries.some(
      (entry) => entry.exerciseId === exercise.id && countsTowardStats(entry) && Boolean(entry.loadKg),
    ),
  )
  return loaded ? 'load' : 'reps'
}

export function seriesFor(exercise: Exercise, sessions: Session[]): Series {
  const kind = seriesKind(exercise, sessions)
  const sorted = [...sessions].sort((a, b) => a.startedAt - b.startedAt)
  const points: SeriesPoint[] = []

  for (const session of sorted) {
    const sets = session.entries.filter(
      (entry) => entry.exerciseId === exercise.id && countsTowardStats(entry),
    )
    if (sets.length === 0) continue

    if (kind === 'e1rm') {
      const values = sets
        .filter((set) => set.weightKg !== null)
        .map((set) => epley(set.weightKg as number, set.reps))
      if (values.length === 0) continue
      points.push({ at: session.startedAt, value: Math.max(...values) })
    } else if (kind === 'reps') {
      const value = sets.reduce((sum, set) => sum + set.reps, 0)
      points.push({ at: session.startedAt, value })
    } else {
      const loads = sets.flatMap((set) => (set.loadKg ? [set.loadKg] : []))
      if (loads.length === 0) continue
      points.push({ at: session.startedAt, value: Math.max(...loads) })
    }
  }

  return { kind, points }
}
