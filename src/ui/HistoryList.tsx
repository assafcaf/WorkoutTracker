import type { Program, Session } from '../types'

/**
 * A finished session, reduced to what the history list shows for it.
 */
export type HistorySummary = {
  sessionId: string
  date: number
  programName: string
  workoutName: string
  totalSets: number
  totalVolumeKg: number
}

/**
 * Reduces a finished session to its `HistorySummary`.
 *
 * `totalVolumeKg` sums `weightKg * reps` over the session's entries; a bodyweight entry
 * (`weightKg === null`) contributes 0. The program and workout names are resolved from
 * `programs`, so a session recorded under a program that no longer exists still renders.
 *
 * E1-T8: not yet implemented.
 */
export function summarise(_session: Session, _programs: Program[]): HistorySummary {
  throw new Error('not implemented')
}

/**
 * The finished sessions given, each reduced through `summarise` and rendered as one row.
 *
 * E1-T8: not yet implemented.
 */
export function HistoryList(_props: { sessions: Session[]; programs: Program[] }): JSX.Element {
  throw new Error('not implemented')
}
