import type { Exercise } from '../types'

export type ExerciseInfoLinkProps = {
  exercise: Exercise
  /**
   * Opens the exercise's in-app detail screen (E5-T8). Replaces the old outbound
   * muscleandstrength.com link -- the control is a button now, not an anchor.
   */
  onOpen(): void
}

/**
 * A link to the exercise's curated demonstration, one tap from the set screen for the
 * exercise you have forgotten how to do.
 */
export function ExerciseInfoLink({ onOpen }: ExerciseInfoLinkProps): JSX.Element {
  return (
    <button type="button" onClick={onOpen}>
      Exercise info
    </button>
  )
}
