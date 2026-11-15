import { useState } from 'react'
import { alternativesFor, swapAlternatives } from '../domain/alternatives'
import { matchesQuery } from '../domain/search'
import { Icon } from './icons'
import type { LibraryExercise } from '../types'
import './AlternativesList.css'

export type AlternativesListProps = {
  target: LibraryExercise
  library: Map<string, LibraryExercise>
  gymEquipment: string[] | null
  /**
   * Swaps to the alternative for today's session. Left `undefined` for a browse-only list (a
   * caller with nothing to swap into, e.g. "Similar exercises" on the detail screen), in which
   * case no row offers "Do this instead" (named "Do <Alternative> instead", V2-14).
   */
  onChoose?(id: string): void
  onOpenDetail(id: string): void
  /** Caps the ranked rows shown; unset shows every ranked alternative. */
  limit?: number
  /**
   * V6-10: the swap list (`swapAlternatives`): the lifter's logged lifts first, by library id,
   * shown under their own names; at most `SWAP_SHOWN` rows until "Show all". Unset: the plain
   * ranked list (`alternativesFor`).
   */
  swap?: { logged: Map<string, string> }
}

/** V6-10: rows the swap list shows before "Show all". */
export const SWAP_SHOWN = 6

/**
 * The ranked alternatives list for `target` (E5-T12): a search box that narrows the ranked
 * rows -- built from `alternativesFor` (E5-T5) -- by name, each row offering "Do this instead"
 * when `onChoose` is given.
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
  const [query, setQuery] = useState('')
  // Lifts the equipment filter for this rendered list only, when it leaves nothing ranked
  // (S12) -- never a prop-changing callback, since there isn't one for "just this list".
  const [showAllEquipment, setShowAllEquipment] = useState(false)
  // V6-10: the swap list past its first rows.
  const [showAll, setShowAll] = useState(false)

  const effectiveGymEquipment = showAllEquipment ? null : gymEquipment
  const ranked = swap
    ? swapAlternatives(target, library, effectiveGymEquipment, new Set(swap.logged.keys()))
    : alternativesFor(target, library, effectiveGymEquipment)
  const nameOf = (alternative: LibraryExercise): string => swap?.logged.get(alternative.id) ?? alternative.name

  if (ranked.length === 0 && effectiveGymEquipment !== null) {
    return (
      <div className="alternatives-list">
        <p className="alternatives-empty">{"No alternatives with your gym's equipment"}</p>
        <button
          type="button"
          className="alternatives-show-all btn-quiet"
          onClick={() => setShowAllEquipment(true)}
        >
          Show all equipment
        </button>
      </div>
    )
  }

  const matching = ranked.filter(
    (alternative) => matchesQuery(alternative.name, query) || matchesQuery(nameOf(alternative), query),
  )
  // A search looks through every alternative; the swap list's first rows are its short list.
  const cap = swap && !showAll && query.trim() === '' ? SWAP_SHOWN : limit
  const shown = cap === undefined ? matching : matching.slice(0, cap)
  const hidden = matching.length - shown.length

  return (
    <div className="alternatives-list">
      {/* V5-11: it says what it searches, beside a magnifier. */}
      <label className="alternatives-search-field">
        <Icon name="Search" size={18} />
        <input
          type="search"
          aria-label="Search alternatives"
          placeholder="Search exercises"
          className="alternatives-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <ul className="alternatives-rows">
        {shown.map((alternative) => (
          <li key={alternative.id} className="alternatives-row">
            <button
              type="button"
              className="alternatives-row-open cell"
              onClick={() => onOpenDetail(alternative.id)}
            >
              <span className="alternatives-row-name">{nameOf(alternative)}</span>
            </button>
            {onChoose ? (
              <button
                type="button"
                className="alternatives-row-choose btn-secondary"
                // V2-14: every row's button reads the same, so its name says which Exercise.
                aria-label={`Do ${nameOf(alternative)} instead`}
                onClick={() => onChoose(alternative.id)}
              >
                Do this instead
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {swap && hidden > 0 && limit === undefined ? (
        <button type="button" className="alternatives-show-all btn-quiet" onClick={() => setShowAll(true)}>
          {`Show all (${matching.length})`}
        </button>
      ) : null}
    </div>
  )
}
