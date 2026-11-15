import type { Exercise, ExercisePlan, Session } from '../types'
import { LiftView } from './LiftView'
import './ExerciseHistoryOverlay.css'

export type ExerciseHistoryOverlayProps = {
  exercise: Exercise
  /** Every Session the app knows; the page reads the finished ones that logged `exercise`. */
  sessions: Session[]
  plan: ExercisePlan
  onClose(): void
  /** The clock; `Date.now` unless a test fixes it. */
  now?: number
}

/**
 * Lift history from the live Session's tools sheet (v6 §6.3): the one Lift page (`LiftView`, the
 * same page Progress opens) as a full-height sheet headed by the lift's name, with Done. Closing it
 * changes nothing under it.
 */
export function ExerciseHistoryOverlay({ exercise, sessions, plan, onClose, now }: ExerciseHistoryOverlayProps): JSX.Element {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="exercise-history-heading" className="overlay-panel exercise-history-overlay">
      <div className="exercise-history-header">
        <h2 id="exercise-history-heading" className="exercise-history-heading">
          {exercise.name}
        </h2>
        <button type="button" className="exercise-history-close btn-quiet" onClick={onClose}>
          Done
        </button>
      </div>
      <LiftView exercise={exercise} plan={plan} sessions={sessions} now={now ?? Date.now()} />
    </div>
  )
}
