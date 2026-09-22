import type { Exercise } from '../types'

export type ExerciseInfoLinkProps = {
  exercise: Exercise
}

/**
 * A link to the exercise's curated demonstration, one tap from the set screen for the
 * exercise you have forgotten how to do.
 */
export function ExerciseInfoLink({ exercise }: ExerciseInfoLinkProps): JSX.Element {
  return (
    <a href={exercise.infoUrl} target="_blank" rel="noopener noreferrer">
      Exercise info
    </a>
  )
}
