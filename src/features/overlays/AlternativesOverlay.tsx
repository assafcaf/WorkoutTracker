import { resolveExercise } from '../../data/resolve'
import type { Exercise, LibraryExercise } from '../../types'
import { swapAlternatives } from '../../domain/alternatives'
import { ExercisePicker } from '../../ui/ExercisePicker'
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
  /** V6R-02: the heading in place of "Swap <name>", e.g. "Replace <name> in Workout A". */
  heading?: string
  /** DX-08: each Exercise's last Set as a row shows it (`lastSetTexts`). Omitted, none show. */
  lastSets?: Map<string, string>
}

/** DX-08: the stand-ins shown under "Similar" before "All". */
const SIMILAR_SHOWN = 6

/**
 * The swap picker App.tsx renders over the current view (E5-T12, E6-T4), as the one Exercise
 * picker (DX-08): "Swap <Plan's name>", the ranked stand-ins under "Similar" (the lifter's logged
 * lifts first, under their own names), then every other Exercise under "All". A row tap picks it.
 * `onOpenDetail` is kept for callers; rows no longer open the detail. Renders nothing while the
 * planned Exercise or its library entry cannot be resolved.
 */
export function AlternativesOverlay({
  plannedId,
  catalog,
  library,
  gymEquipment,
  onPick,
  onClose,
  loggedIds = [],
  taken = [],
  heading,
  lastSets,
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

  // DX-08: the one Exercise picker. The ranked stand-ins lead under "Similar", then "All".
  const similar = swapAlternatives(target, libraryMap, null, new Set(logged.keys()))
    .filter((alternative) => !exclude.has(alternative.id))
    .slice(0, SIMILAR_SHOWN)
  return (
    <ExercisePicker
      headingId="alternatives-heading"
      title={heading ?? `Swap ${planned.name}`}
      library={library.filter((entry) => entry.id !== target.id)}
      taken={[...exclude]}
      similar={similar}
      gymEquipment={gymEquipment}
      nameOf={(entry) => logged.get(entry.id)?.name ?? entry.name}
      pickIdOf={(entry) => logged.get(entry.id)?.id ?? entry.id}
      lastSets={lastSets}
      onPick={onPick}
      onClose={onClose}
    />
  )
}
