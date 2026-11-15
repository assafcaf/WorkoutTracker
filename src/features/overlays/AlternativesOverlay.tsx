import { resolveExercise } from '../../data/resolve'
import type { Exercise, LibraryExercise } from '../../types'
import { AlternativesList } from '../../ui/AlternativesList'
import { Icon } from '../../ui/icons'
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
  /**
   * V6-10: the Exercise ids the lifter has logged (catalog or library); their library entries
   * lead the list under the lifter's own names. Omitted, none do.
   */
  loggedIds?: Iterable<string>
  /** V6-10: the Exercise ids already in today's Workout; their library entries are not offered. */
  taken?: Iterable<string>
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
  loggedIds = [],
  taken = [],
}: AlternativesOverlayProps): JSX.Element | null {
  const libraryMap = new Map(library.map((entry) => [entry.id, entry] as const))
  const planned = resolveExercise(plannedId, catalog, libraryMap)
  const target = planned ? libraryMap.get(planned.libraryId) ?? null : null
  if (!planned || !target) return null
  // V6-10: each logged lift's library entry, named as the lifter knows it ("Hyper-extension").
  const logged = new Map<string, { id: string; name: string }>()
  const exclude = new Set<string>()
  for (const id of taken) {
    const exercise = resolveExercise(id, catalog, libraryMap)
    if (exercise) exclude.add(exercise.libraryId)
  }
  for (const id of loggedIds) {
    const exercise = resolveExercise(id, catalog, libraryMap)
    if (exercise && !logged.has(exercise.libraryId)) logged.set(exercise.libraryId, { id, name: exercise.name })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="alternatives-heading"
      className="overlay-panel alternatives-overlay"
    >
      <div className="alternatives-overlay-header">
        <h2 id="alternatives-heading" className="alternatives-overlay-heading">
          Alternatives to {planned.name}
        </h2>
        {/* V5-11: an X the size of a thumb, still named Close. */}
        <button type="button" className="alternatives-overlay-close icon-btn" aria-label="Close" onClick={onClose}>
          <Icon name="X" size={22} />
        </button>
      </div>
      <AlternativesList
        target={target}
        library={libraryMap}
        gymEquipment={gymEquipment}
        onChoose={onPick}
        onOpenDetail={onOpenDetail}
        swap={{ logged, exclude }}
      />
    </div>
  )
}
