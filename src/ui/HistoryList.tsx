import { useState } from 'react'
import { formatSet } from '../domain/setText'
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

/** A set as the card lists it: `80 × 8`, or `BW × 15` for a bodyweight set. */
function setLabel(entry: SetEntry): string {
  return formatSet(entry)
}

/** A session's length in whole minutes, from `startedAt` to `finishedAt` (0 while unfinished). */
function durationMinutes(session: Session): number {
  if (session.finishedAt === null) return 0
  return Math.max(0, Math.round((session.finishedAt - session.startedAt) / 60_000))
}

type HistoryListProps = {
  sessions: Session[]
  programs: Program[]
  resolve: (id: string) => Exercise | undefined
  /** Opens a session's summary (E5-T20, M16) from its card's "Open session" button. */
  onOpen?(sessionId: string): void
  /** Opens the History editor (E12-T6) from a card's "Edit workout" or an Exercise's "Edit". */
  onEdit?(sessionId: string, exerciseId?: string): void
}

/** One finished session as a card: collapsed to its header, expanded to its Exercises. */
function HistoryCard(props: { session: Session } & Omit<HistoryListProps, 'sessions'>): JSX.Element {
  const { session, programs, resolve, onOpen, onEdit } = props
  const [open, setOpen] = useState(false)
  const summary = summarise(session, programs)

  return (
    <li className="history-row">
      <button
        type="button"
        className="history-toggle"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="history-date">{calendarDate(summary.date)}</span>{' '}
        <span className="history-program">{summary.programName}</span>{' '}
        <span className="history-workout">{summary.workoutName}</span>{' '}
        <span className="history-duration">{`${durationMinutes(session)} min`}</span>{' '}
        <span className="history-sets">{`${summary.totalSets} sets`}</span>{' '}
        <span className="history-volume">{`${summary.totalVolumeKg} kg`}</span>
      </button>
      {open ? (
        <>
          {/* `role="presentation"` on the group `<li>`s below: `getByRole('listitem')` must
              keep finding exactly the session card above (App.test.tsx's O8/O9/O17 pre-date
              grouping and query it singular), while S11 still needs a real `<li>` ancestor to
              scope each exercise's sets through `.closest('li')`. */}
          <ul className="history-groups" role="presentation">
            {groupByExercise(session.entries, resolve).map((group) => (
              <li key={group.exerciseId} className="history-group" role="presentation">
                <div className="history-group-head">
                  <h4 className="history-group-heading">{group.name}</h4>
                  {onEdit ? (
                    <button
                      type="button"
                      className="history-group-edit"
                      onClick={() => onEdit(session.id, group.exerciseId)}
                    >
                      Edit
                    </button>
                  ) : null}
                </div>
                <div className="history-group-sets">
                  {group.entries.map((entry) => (
                    <p key={entry.setIndex} className="history-group-set">
                      {setLabel(entry)}
                    </p>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          {onOpen ? (
            <button type="button" className="history-open" onClick={() => onOpen(session.id)}>
              Open session
            </button>
          ) : null}
          {onEdit ? (
            <button type="button" className="history-edit" onClick={() => onEdit(session.id)}>
              Edit workout
            </button>
          ) : null}
        </>
      ) : null}
    </li>
  )
}

/**
 * The finished sessions given, each reduced through `summarise` and rendered as one collapsible
 * card (E12-T9): a header until tapped, then its sets grouped by exercise under the name
 * `resolve` gives that exercise's id -- a catalog id, or a library id swapped in mid-session
 * (E5-T15).
 */
export function HistoryList(props: HistoryListProps): JSX.Element {
  const { sessions, ...rest } = props

  if (sessions.length === 0) {
    return (
      <p className="history-empty">
        No finished workouts yet. Finish one and it appears here.
      </p>
    )
  }

  return (
    <ul className="history-list">
      {sessions.map((session) => (
        <HistoryCard key={session.id} session={session} {...rest} />
      ))}
    </ul>
  )
}
