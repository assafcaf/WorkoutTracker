import { recordsSetBy } from '../domain/records'
import { formatSetCompact } from '../domain/setText'
import type { Exercise, ExercisePlan, Session, SetEntry, SetKind } from '../types'
import './ExerciseHistoryOverlay.css'

export type ExerciseHistoryOverlayProps = {
  exercise: Exercise
  /** Every Session the app knows; the overlay lists the finished ones that logged `exercise`. */
  sessions: Session[]
  plan: ExercisePlan
  onClose(): void
}

const KIND_MARKERS: Record<SetKind, string> = { warmup: 'W', drop: 'D', failure: 'F', amrap: 'A' }

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `Tue 6 Oct`, in the device's local time. */
function dateText(at: number): string {
  const d = new Date(at)
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/**
 * The History overlay (E16-T7): every finished Session that logged the Exercise, newest first,
 * read-only.
 */
export function ExerciseHistoryOverlay({
  exercise,
  sessions,
  plan,
  onClose,
}: ExerciseHistoryOverlayProps): JSX.Element {
  const logged = sessions
    .filter((s) => s.finishedAt !== null && s.entries.some((e) => e.exerciseId === exercise.id))
    .sort((a, b) => b.startedAt - a.startedAt)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="exercise-history-heading"
      className="overlay-panel exercise-history-overlay"
    >
      <div className="exercise-history-header">
        <h2 id="exercise-history-heading" className="exercise-history-heading">
          History · {exercise.name}
        </h2>
        <button type="button" className="exercise-history-close" onClick={onClose}>
          Close
        </button>
      </div>
      {logged.length === 0 ? (
        <p className="exercise-history-empty">No earlier Sessions</p>
      ) : (
        <ul className="exercise-history-list">
          {logged.map((s) => {
            const entries = s.entries
              .filter((e) => e.exerciseId === exercise.id)
              .sort((a, b) => a.setIndex - b.setIndex)
            const earlier = logged.filter((o) => o.startedAt < s.startedAt)
            const isRecord = (entry: SetEntry): boolean =>
              recordsSetBy(exercise, plan, earlier, s, entry).length > 0
            return (
              <li key={s.id} className="exercise-history-session">
                <span className="exercise-history-date">{dateText(s.startedAt)}</span>
                <span className="exercise-history-sets">
                  {entries.map(formatSetCompact).join(' · ')}
                </span>
                {entries.map((entry) =>
                  entry.kind === undefined ? null : (
                    <span key={`k${entry.setIndex}`} className="set-kind-marker">
                      {KIND_MARKERS[entry.kind]}
                    </span>
                  ),
                )}
                {entries.some(isRecord) ? (
                  <span className="tag tag-pr" aria-label="Personal record">
                    PR
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
