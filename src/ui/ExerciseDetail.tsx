import type { LibraryExercise, Video } from '../types'
import './ExerciseDetail.css'

export type ExerciseDetailProps = {
  entry: LibraryExercise
  video?: Video
  heading?: string
  photos: string[]
  onBack(): void
}

/**
 * The exercise detail screen: profile, numbered instructions, video link and photos (E5-T4).
 *
 * Not implemented yet -- this stub only exists so ExerciseDetail.test.tsx can import it and
 * run red. `heading` is meant to default to `entry.name` once implemented.
 */
export function ExerciseDetail({ onBack }: ExerciseDetailProps): JSX.Element {
  return (
    <article className="exercise-detail">
      <button type="button" className="exercise-detail-back" onClick={onBack}>
        Back
      </button>
    </article>
  )
}
