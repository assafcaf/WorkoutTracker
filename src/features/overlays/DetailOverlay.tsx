import { photoUrls } from '../../data/photos'
import type { Exercise, LibraryExercise, Video } from '../../types'
import { ExerciseDetail } from '../../ui/ExerciseDetail'

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
}

/**
 * The exercise detail overlay App.tsx renders over the current view (E5-T8, E5-T15). Renders
 * nothing while `libraryId` is not in `library` (not loaded yet, or a stale id).
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
}: DetailOverlayProps): JSX.Element | null {
  const entry = library.find((candidate) => candidate.id === libraryId)
  if (!entry) return null

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
    />
  )
}
