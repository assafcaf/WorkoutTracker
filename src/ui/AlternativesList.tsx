import { useState } from 'react'
import { alternativesFor } from '../domain/alternatives'
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
}: AlternativesListProps): JSX.Element {
  const [query, setQuery] = useState('')

  const ranked = alternativesFor(target, library, gymEquipment)
  const search = query.trim().toLowerCase()
  const matching = search === '' ? ranked : ranked.filter((alternative) =>
    alternative.name.toLowerCase().includes(search),
  )
  const shown = limit === undefined ? matching : matching.slice(0, limit)

  return (
    <div className="alternatives-list">
      <input
        type="search"
        aria-label="Search alternatives"
        className="alternatives-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <ul className="alternatives-rows">
        {shown.map((alternative) => (
          <li key={alternative.id} className="alternatives-row">
            <button
              type="button"
              className="alternatives-row-open"
              onClick={() => onOpenDetail(alternative.id)}
            >
              <span className="alternatives-row-name">{alternative.name}</span>
            </button>
            {onChoose ? (
              <button
                type="button"
                className="alternatives-row-choose"
                onClick={() => onChoose(alternative.id)}
              >
                Do this instead
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
