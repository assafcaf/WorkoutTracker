import type { Exercise, ExercisePlan, Session } from '../types'

export type ExerciseHistoryOverlayProps = {
  exercise: Exercise
  /** Every Session the app knows; the overlay lists the finished ones that logged `exercise`. */
  sessions: Session[]
  plan: ExercisePlan
  onClose(): void
}

/**
 * The History overlay (E16-T7): every finished Session that logged the Exercise, newest first,
 * read-only. Not implemented yet.
 */
export function ExerciseHistoryOverlay(_props: ExerciseHistoryOverlayProps): JSX.Element | null {
  return null
}
