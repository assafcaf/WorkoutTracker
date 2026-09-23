import type { Exercise, Session } from '../types'

export type SeriesKind = 'e1rm' | 'reps' | 'assistance'
export type SeriesPoint = { at: number; value: number }
export type Series = { kind: SeriesKind; inverted: boolean; points: SeriesPoint[] }

export function epley(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30)
}

export function seriesFor(exercise: Exercise, sessions: Session[]): Series {
  const kind: SeriesKind = exercise.invertProgress
    ? 'assistance'
    : exercise.bodyweight
      ? 'reps'
      : 'e1rm'
  const inverted = exercise.invertProgress

  const sorted = [...sessions].sort((a, b) => a.startedAt - b.startedAt)
  const points: SeriesPoint[] = []

  for (const session of sorted) {
    const sets = session.entries.filter((entry) => entry.exerciseId === exercise.id)
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
      const weights = sets
        .filter((set) => set.weightKg !== null)
        .map((set) => set.weightKg as number)
      if (weights.length === 0) continue
      points.push({ at: session.startedAt, value: Math.min(...weights) })
    }
  }

  return { kind, inverted, points }
}
