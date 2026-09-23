import type { Exercise } from '../types'

export type ExerciseInfoLinkProps = {
  exercise: Exercise
  onOpen(): void
}

/**
 * The set screen's control onto the exercise's in-app detail screen (E5-T8). Used to be a
 * link straight out to a curated muscleandstrength.com URL; is now a button that tells its
 * caller to open the overlay instead of leaving the app.
 *
 * STUB (E5-T8 test-designer): renders the button but does not yet call `onOpen`.
 */
export function ExerciseInfoLink({ onOpen: _onOpen }: ExerciseInfoLinkProps): JSX.Element {
  return (
    <button type="button">
      Exercise info
    </button>
  )
}
