import { photoUrls } from '../../data/photos'
import type { Exercise, LibraryExercise, Video } from '../../types'
import { ExerciseDetail } from '../../ui/ExerciseDetail'
import { Icon } from '../../ui/icons'

export type DetailOverlayProps = {
  libraryId: string
  heading?: string
  /** Set only when opened from a live set; only then does a "Similar exercises" row swap. */
  plannedId?: string
  catalog: Map<string, Exercise>
  library: LibraryExercise[]
  videos: Map<string, Video>
  gymEquipment: string[] | null
  onBack(): void
  onOpenDetail(libraryId: string): void
  onSwap?(libraryId: string): void
  /** Offers `Edit` on the detail (E19-T11); the Exercises tab passes it for a custom Exercise only. */
  onEdit?(libraryId: string): void
}

/**
 * The exercise detail overlay App.tsx renders over the current view (E5-T8, E5-T15). An id the
 * library lacks never fails silently: the overlay still opens, saying the library is loading or
 * that there is no info for that exercise, with Back.
 */
export function DetailOverlay({
  libraryId,
  heading,
  plannedId,
  catalog,
  library,
  videos,
  gymEquipment,
  onBack,
  onOpenDetail,
  onSwap,
  onEdit,
}: DetailOverlayProps): JSX.Element | null {
  const entry = library.find((candidate) => candidate.id === libraryId)
  if (!entry) {
    const title = heading ?? catalog.get(libraryId)?.name ?? 'Exercise info'
    return (
      <article className="exercise-detail overlay-panel overlay-panel--pushed" role="dialog" aria-label={title}>
        <header className="exercise-detail-bar">
          <button type="button" className="exercise-detail-back btn-quiet" aria-label="Back" onClick={onBack}>
            <Icon name="ChevronLeft" size={24} />
          </button>
          <h1 className="exercise-detail-heading">{title}</h1>
        </header>
        <p className="exercise-detail-none" role="status">
          {library.length === 0 ? 'Loading exercise info…' : 'No info for this exercise yet.'}
        </p>
      </article>
    )
  }

  const libraryMap = new Map(library.map((item) => [item.id, item] as const))
  const catalogLibraryIds = new Set(Array.from(catalog.values(), (exercise) => exercise.libraryId))

  return (
    <ExerciseDetail
      entry={entry}
      video={videos.get(entry.id)}
      heading={heading}
      photos={photoUrls(entry, catalogLibraryIds, import.meta.env.BASE_URL)}
      onBack={onBack}
      library={libraryMap}
      gymEquipment={gymEquipment}
      onOpenDetail={onOpenDetail}
      onChoose={plannedId !== undefined ? onSwap : undefined}
      onEdit={onEdit === undefined ? undefined : () => onEdit(entry.id)}
    />
  )
}
