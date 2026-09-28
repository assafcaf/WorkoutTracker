import { resolveExercise } from '../../data/resolve'
import type { Exercise, LibraryExercise } from '../../types'
import { AlternativesList } from '../../ui/AlternativesList'
import '../../ui/AlternativesOverlay.css'

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
 * The ranked alternatives overlay App.tsx renders over the current view (E5-T12, E6-T4): ranked
 * against the planned exercise's own library entry, and headed with the Plan's current name
 * for it, which can differ from the library's. Renders nothing while either cannot be resolved.
 */
export function AlternativesOverlay({
  plannedId,
  catalog,
  library,
  gymEquipment,
  onPick,
  onOpenDetail,
  onClose,
}: AlternativesOverlayProps): JSX.Element | null {
  const libraryMap = new Map(library.map((entry) => [entry.id, entry] as const))
  const planned = resolveExercise(plannedId, catalog, libraryMap)
  const target = planned ? libraryMap.get(planned.libraryId) ?? null : null
  if (!planned || !target) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="alternatives-heading"
      className="overlay-panel alternatives-overlay"
    >
      <h2 id="alternatives-heading" className="alternatives-overlay-heading">
        Alternatives to {planned.name}
      </h2>
      <button type="button" className="alternatives-overlay-close" onClick={onClose}>
        Close
      </button>
      <AlternativesList
        target={target}
        library={libraryMap}
        gymEquipment={gymEquipment}
        onChoose={onPick}
        onOpenDetail={onOpenDetail}
      />
    </div>
  )
}
