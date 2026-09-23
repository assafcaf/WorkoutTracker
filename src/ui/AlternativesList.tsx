import type { LibraryExercise } from '../types'
import './AlternativesList.css'

export type AlternativesListProps = {
  target: LibraryExercise
  library: Map<string, LibraryExercise>
  gymEquipment: string[] | null
  /**
   * Swaps to the alternative for today's session. Left `undefined` for a browse-only list (a
   * caller with nothing to swap into, e.g. "Similar exercises" on the detail screen), in which
   * case no row offers "Do this instead".
   */
  onChoose?(id: string): void
  onOpenDetail(id: string): void
  /** Caps the ranked rows shown; unset shows every ranked alternative. */
  limit?: number
}

/**
 * The ranked alternatives list for `target` (E5-T12): a search box that narrows the ranked
 * rows by name, each row offering "Do this instead" when `onChoose` is given.
 *
 * STUB (E5-T12 test-designer): renders the search box only. The ranked rows -- built from
 * `alternativesFor` (E5-T5) -- the name filter and "Do this instead" are not yet implemented.
 */
export function AlternativesList(_props: AlternativesListProps): JSX.Element {
  return (
    <div className="alternatives-list">
      <input type="search" aria-label="Search alternatives" className="alternatives-search" />
    </div>
  )
}
