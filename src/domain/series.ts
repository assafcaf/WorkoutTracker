import type { Exercise, Session } from '../types'

export type SeriesKind = 'e1rm' | 'reps' | 'assistance'
export type SeriesPoint = { at: number; value: number }
export type Series = { kind: SeriesKind; inverted: boolean; points: SeriesPoint[] }

export function epley(weightKg: number, reps: number): number {
  throw new Error('not implemented')
}

export function seriesFor(exercise: Exercise, sessions: Session[]): Series {
  throw new Error('not implemented')
}
