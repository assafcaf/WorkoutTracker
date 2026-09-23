import { useState } from 'react'
import { AlternativesList } from './AlternativesList'
import { BodyMap } from './body/BodyMap'
import { toRegionCounts, type Region } from '../domain/muscles'
import type { LibraryExercise, Muscle, Video } from '../types'
import './ExerciseDetail.css'

export type ExerciseDetailProps = {
  entry: LibraryExercise
  video?: Video
  heading?: string
  photos: string[]
  onBack(): void
  /** Every library exercise, keyed by id -- ranks the "Similar exercises" section (E5-T15). */
  library: Map<string, LibraryExercise>
  /** Filters "Similar exercises" to the gym's equipment; `null` means no filter. */
  gymEquipment: string[] | null
  /** Opens another exercise's own detail screen from a "Similar exercises" row. */
  onOpenDetail(id: string): void
  /**
   * Swaps to a "Similar exercises" row for today's session. Left `undefined` when the detail
   * screen was opened from the Exercises tab rather than a live set, in which case no row
   * offers "Do this instead" (E5-T15).
   */
  onChoose?(id: string): void
}

/** What `entry` trains, per region: 1 per primary muscle, 0.5 per secondary muscle (M10). */
function exerciseRegionCounts(entry: LibraryExercise): Map<Region, number> {
  const muscleCounts = new Map<Muscle, number>()
  for (const muscle of entry.primaryMuscles) {
    muscleCounts.set(muscle, (muscleCounts.get(muscle) ?? 0) + 1)
  }
  for (const muscle of entry.secondaryMuscles) {
    muscleCounts.set(muscle, (muscleCounts.get(muscle) ?? 0) + 0.5)
  }
  return toRegionCounts(muscleCounts)
}

/**
 * The exercise detail screen: profile, numbered instructions, video link and photos (E5-T4).
 *
 * `heading` defaults to `entry.name`. `photos` is a list of already-resolved URLs (see
 * `photoUrls` in `src/data/photos.ts`); a photo that fails to load is replaced in place with a
 * "Photos need a connection" placeholder, tracked by index so the other photos are unaffected.
 *
 * A "Similar exercises" section (E5-T15) composes the same ranked `AlternativesList` (E5-T12)
 * used mid-session, capped to the top 5, with no swap -- each row opens that alternative's own
 * detail screen instead. It offers "Do this instead" only when `onChoose` is given, i.e. this
 * screen was opened from a live set rather than the Exercises tab.
 *
 * A body map (E5-T17) under the profile shows what the exercise trains: its primary muscles'
 * regions in the primary shade, its secondary muscles' regions in the secondary shade.
 */
export function ExerciseDetail({
  entry,
  video,
  heading,
  photos,
  onBack,
  library,
  gymEquipment,
  onOpenDetail,
  onChoose,
}: ExerciseDetailProps): JSX.Element {
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

      <BodyMap counts={exerciseRegionCounts(entry)} scale="exercise" />

      {video && (
        <p className="exercise-detail-video">
          <a
            href={
              // Vimeo embeds are domain-locked to M&S, so a vimeo video is watched on its page.
              video.provider === 'youtube'
                ? `https://www.youtube.com/watch?v=${video.id}`
                : video.source
            }
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

      <section className="exercise-detail-similar">
        <h2 className="exercise-detail-similar-heading">Similar exercises</h2>
        <AlternativesList
          target={entry}
          library={library}
          gymEquipment={gymEquipment}
          onOpenDetail={onOpenDetail}
          onChoose={onChoose}
          limit={5}
        />
      </section>
    </article>
  )
}
