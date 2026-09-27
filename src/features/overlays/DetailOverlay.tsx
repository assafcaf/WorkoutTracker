import type { Exercise, LibraryExercise, Video } from '../../types'

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
 * The exercise detail overlay App.tsx renders over the current view (E5-T8, E5-T15).
 *
 * STUB (E11-T9 test-designer): not implemented yet.
 */
export function DetailOverlay(_props: DetailOverlayProps): JSX.Element | null {
  throw new Error('not implemented: DetailOverlay')
}
