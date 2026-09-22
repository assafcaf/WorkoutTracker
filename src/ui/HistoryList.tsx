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
 * `programs`, so a session recorded under a program that no longer exists still renders --
 * falling back to the session's own stored `programId` / `workoutId`.
 */
export function summarise(session: Session, programs: Program[]): HistorySummary {
  const program = programs.find((candidate) => candidate.id === session.programId)
  const workout = program?.workouts.find((candidate) => candidate.id === session.workoutId)

  const totalVolumeKg = session.entries.reduce(
    (total, entry) => total + (entry.weightKg ?? 0) * entry.reps,
    0,
  )

  return {
    sessionId: session.id,
    date: session.startedAt,
    programName: program?.name ?? session.programId,
    workoutName: workout?.name ?? session.workoutId,
    totalSets: session.entries.length,
    totalVolumeKg,
  }
}

/** The ISO calendar date a session's row shows, independent of the local timezone. */
function calendarDate(date: number): string {
  return new Date(date).toISOString().slice(0, 10)
}

/**
 * The finished sessions given, each reduced through `summarise` and rendered as one row.
 */
export function HistoryList(props: { sessions: Session[]; programs: Program[] }): JSX.Element {
  const { sessions, programs } = props

  return (
    <ul className="history-list">
      {sessions.map((session) => {
        const summary = summarise(session, programs)
        return (
          <li key={summary.sessionId}>
            <span className="history-date">{calendarDate(summary.date)}</span>{' '}
            <span className="history-program">{summary.programName}</span>{' '}
            <span className="history-workout">{summary.workoutName}</span>{' '}
            <span className="history-sets">{`${summary.totalSets} sets`}</span>{' '}
            <span className="history-volume">{`${summary.totalVolumeKg} kg`}</span>
          </li>
        )
      })}
    </ul>
  )
}
