import type { Exercise, LibraryExercise } from '../../types'

export type AlternativesOverlayProps = {
  /** The plan's exercise id, or the library id swapped in for it. */
  plannedId: string
  catalog: Map<string, Exercise>
  library: LibraryExercise[]
  gymEquipment: string[] | null
  onPick(libraryId: string): void
  onOpenDetail(libraryId: string): void
  onClose(): void
}

/**
 * The ranked alternatives overlay App.tsx renders over the current view (E5-T12, E6-T4).
 *
 * STUB (E11-T9 test-designer): not implemented yet.
 */
export function AlternativesOverlay(_props: AlternativesOverlayProps): JSX.Element | null {
  throw new Error('not implemented: AlternativesOverlay')
}
