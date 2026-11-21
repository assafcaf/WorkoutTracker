import { alternativesFor, swapAlternatives } from '../domain/alternatives'
import type { LibraryExercise } from '../types'
import { ExercisePickerList, pickerRow } from './ExercisePicker'
import './AlternativesList.css'

export type AlternativesListProps = {
  target: LibraryExercise
  library: Map<string, LibraryExercise>
  gymEquipment: string[] | null
  /**
   * Swaps to the alternative for today's session: a row tap calls it. Left `undefined` for a
   * browse-only list, where a row tap opens it; a short `limit` list (Exercise info's "Similar
   * exercises") always opens its rows.
   */
  onChoose?(id: string): void
  onOpenDetail(id: string): void
  /** Caps the ranked rows shown; unset shows every ranked alternative. */
  limit?: number
  /**
   * V6-10: the swap list (`swapAlternatives`): the lifter's logged lifts first, keyed by library
   * id, each shown under its own name and chosen as its own Exercise id (the one with history).
   * Unset: the plain ranked list (`alternativesFor`).
   */
  swap?: { logged: Map<string, { id: string; name: string }>; exclude?: ReadonlySet<string> }
}

/** V6-10: the stand-ins a swap shows under "Similar" before "All". */
export const SWAP_SHOWN = 6

/**
 * The ranked alternatives for `target` (E5-T12), drawn by the one Exercise list (DX-08): search,
 * "My gym only", and rows whose whole width is the target -- choose when `onChoose` is given,
 * else open the detail. No "Do this instead" buttons.
 */
export function AlternativesList({
  target,
  library,
  gymEquipment,
  onChoose,
  onOpenDetail,
  limit,
  swap,
}: AlternativesListProps): JSX.Element {
  // A short list (Exercise info's "Similar exercises", `limit`) is fixed: ranked for the gym, no
  // search or chip; when the gym leaves none, every piece of equipment counts. The full list is
  // ranked without the gym's filter, and its "My gym only" chip applies it, and can lift it.
  const bare = limit !== undefined
  const rank = (equipment: string[] | null): LibraryExercise[] =>
    swap
      ? swapAlternatives(target, library, equipment, new Set(swap.logged.keys())).filter(
          (alternative) => !swap.exclude?.has(alternative.id),
        )
      : alternativesFor(target, library, equipment)
  const forGym = bare ? rank(gymEquipment) : []
  const ranked = bare && forGym.length > 0 ? forGym : rank(null)
  const pickId = (id: string): string => swap?.logged.get(id)?.id ?? id
  const rows = ranked.map((entry) => pickerRow(entry, { name: swap?.logged.get(entry.id)?.name }))

  return (
    <div className="alternatives-list">
      <ExercisePickerList
        rows={rows}
        gymEquipment={bare ? undefined : gymEquipment}
        searchable={!bare}
        limit={limit}
        // A short list on Exercise info is for browsing: its rows open their own detail.
        onPick={(id) => (onChoose && !bare ? onChoose(pickId(id)) : onOpenDetail(id))}
      />
    </div>
  )
}
