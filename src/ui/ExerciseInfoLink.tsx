import type { Exercise } from '../types'

export type ExerciseInfoLinkProps = {
  exercise: Exercise
  onOpen(): void
}

/**
 * The set screen's control onto the exercise's in-app detail screen (E5-T8). Used to be a
 * link straight out to a curated muscleandstrength.com URL; is now a button that tells its
 * caller to open the overlay instead of leaving the app.
 */
export function ExerciseInfoLink({ onOpen }: ExerciseInfoLinkProps): JSX.Element {
  return (
    <button type="button" onClick={onOpen}>
      Exercise info
    </button>
  )
}
