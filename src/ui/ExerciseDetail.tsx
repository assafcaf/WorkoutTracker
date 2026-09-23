import { useState } from 'react'
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
 * `heading` defaults to `entry.name`. `photos` is a list of already-resolved URLs (see
 * `photoUrls` in `src/data/photos.ts`); a photo that fails to load is replaced in place with a
 * "Photos need a connection" placeholder, tracked by index so the other photos are unaffected.
 */
export function ExerciseDetail({ entry, video, heading, photos, onBack }: ExerciseDetailProps): JSX.Element {
  const [failedPhotos, setFailedPhotos] = useState<Set<number>>(new Set())

  return (
    <article className="exercise-detail">
      <button type="button" className="exercise-detail-back" onClick={onBack}>
        Back
      </button>
      <h1 className="exercise-detail-heading">{heading ?? entry.name}</h1>

      <div className="exercise-detail-profile">
        <p className="exercise-detail-field">Primary muscle: {entry.primaryMuscles.join(', ')}</p>
        <p className="exercise-detail-field">Secondary muscles: {entry.secondaryMuscles.join(', ')}</p>
        <p className="exercise-detail-field">Equipment: {entry.equipment}</p>
        <p className="exercise-detail-field">Mechanic: {entry.mechanic}</p>
        <p className="exercise-detail-field">Force: {entry.force}</p>
        <p className="exercise-detail-field">Level: {entry.level}</p>
      </div>

      {video && (
        <p className="exercise-detail-video">
          <a
            href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Watch video
          </a>{' '}
          <a href={video.source} target="_blank" rel="noopener noreferrer">
            Video: Muscle &amp; Strength
          </a>
        </p>
      )}

      <ol className="exercise-detail-instructions">
        {entry.instructions.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>

      <div className="exercise-detail-photos">
        {photos.map((url, index) =>
          failedPhotos.has(index) ? (
            <p key={url} className="exercise-detail-photo-placeholder">
              Photos need a connection
            </p>
          ) : (
            <img
              key={url}
              src={url}
              alt={`${entry.name} photo ${index + 1}`}
              className="exercise-detail-photo"
              onError={() => setFailedPhotos((previous) => new Set(previous).add(index))}
            />
          ),
        )}
      </div>
    </article>
  )
}
