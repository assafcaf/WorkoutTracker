import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Exercise, ExercisePlan, Session } from '../types'
import { Icon } from './icons'
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
  /**
   * DX-07: the Exercise's info for "How to do it ›" at the top of the page. Given, the link shows
   * and a tap puts the info in this overlay's place (never a second overlay over it); the info's ‹
   * comes back here. `open` moves to another Exercise's info (its similar exercises).
   */
  renderInfo?(libraryId: string, nav: { back(): void; open(libraryId: string): void }): ReactNode
}

/**
 * Lift history from the live Session's History button (v6 §6.3, DX-07): the one Lift page
 * (`LiftView`, the same page Progress opens) as a full-height page headed by the lift's name,
 * with a bare ‹ at the left like every pushed page (DX-06, N7). Closing it changes nothing under it.
 */
export function ExerciseHistoryOverlay({
  exercise,
  sessions,
  plan,
  onClose,
  now,
  renderInfo,
}: ExerciseHistoryOverlayProps): JSX.Element {
  const [infoId, setInfoId] = useState<string | null>(null)
  if (infoId !== null && renderInfo) {
    return <>{renderInfo(infoId, { back: () => setInfoId(null), open: setInfoId })}</>
  }
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="exercise-history-heading" className="overlay-panel exercise-history-overlay">
      <div className="exercise-history-header">
        <button type="button" className="exercise-history-back icon-btn" aria-label="Back" onClick={onClose}>
          <Icon name="ChevronLeft" size={24} />
        </button>
        <h2 id="exercise-history-heading" className="exercise-history-heading">
          {exercise.name}
        </h2>
      </div>
      <LiftView
        exercise={exercise}
        plan={plan}
        sessions={sessions}
        now={now ?? Date.now()}
        onHowTo={renderInfo ? () => setInfoId(exercise.libraryId) : undefined}
      />
    </div>
  )
}
