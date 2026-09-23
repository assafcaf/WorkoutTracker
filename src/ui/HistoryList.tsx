import type { Exercise, Program, Session, SetEntry } from '../types'
import './HistoryList.css'

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

/** One session's entries, grouped by `exerciseId` and headed by its resolved name, in the
 * order each exercise first appears among the session's entries. */
function groupByExercise(
  entries: SetEntry[],
  resolve: (id: string) => Exercise | undefined,
): { exerciseId: string; name: string; entries: SetEntry[] }[] {
  const order: string[] = []
  const byExercise = new Map<string, SetEntry[]>()

  for (const entry of entries) {
    let group = byExercise.get(entry.exerciseId)
    if (!group) {
      group = []
      byExercise.set(entry.exerciseId, group)
      order.push(entry.exerciseId)
    }
    group.push(entry)
  }

  return order.map((exerciseId) => ({
    exerciseId,
    name: resolve(exerciseId)?.name ?? exerciseId,
    entries: byExercise.get(exerciseId) ?? [],
  }))
}

/**
 * The finished sessions given, each reduced through `summarise` and rendered as one row, with
 * its sets grouped by exercise under the name `resolve` gives that exercise's id -- a catalog
 * id, or a library id swapped in mid-session (E5-T15).
 */
export function HistoryList(props: {
  sessions: Session[]
  programs: Program[]
  resolve: (id: string) => Exercise | undefined
  /** Opens a session's summary (E5-T20, M16) from its row's "Open session" button. */
  onOpen?(sessionId: string): void
}): JSX.Element {
  const { sessions, programs, resolve, onOpen } = props

  return (
    <ul className="history-list">
      {sessions.map((session) => {
        const summary = summarise(session, programs)
        const groups = groupByExercise(session.entries, resolve)
        return (
          <li key={summary.sessionId} className="history-row">
            <div className="history-summary">
              <span className="history-date">{calendarDate(summary.date)}</span>{' '}
              <span className="history-program">{summary.programName}</span>{' '}
              <span className="history-workout">{summary.workoutName}</span>{' '}
              <span className="history-sets">{`${summary.totalSets} sets`}</span>{' '}
              <span className="history-volume">{`${summary.totalVolumeKg} kg`}</span>
            </div>
            {onOpen ? (
              <button
                type="button"
                className="history-open"
                onClick={() => onOpen(session.id)}
              >
                Open session
              </button>
            ) : null}
            {/* `role="presentation"` on the group `<li>`s below: `getByRole('listitem')` must
                keep finding exactly the session row above (App.test.tsx's O8/O9/O17 pre-date
                grouping and query it singular), while S11 still needs a real `<li>` ancestor to
                scope each exercise's sets through `.closest('li')`. */}
            <ul className="history-groups" role="presentation">
              {groups.map((group) => (
                <li key={group.exerciseId} className="history-group" role="presentation">
                  <h4 className="history-group-heading">{group.name}</h4>
                  <div className="history-group-sets">
                    {group.entries.map((entry) => (
                      <p key={entry.setIndex} className="history-group-set">
                        {`Set ${entry.setIndex}: ${entry.weightKg ?? 'bodyweight'}${
                          entry.weightKg === null ? '' : ' kg'
                        } x ${entry.reps}`}
                      </p>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </li>
        )
      })}
    </ul>
  )
}
