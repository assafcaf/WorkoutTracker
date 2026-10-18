import { useState } from 'react'
import { matchesQuery } from '../domain/search'
import type { LibraryExercise } from '../types'
import './ExercisePicker.css'

export type ExercisePickerProps = {
  library: LibraryExercise[]
  /** Ids already in the Session: not offered again. */
  taken: string[]
  onPick(id: string): void
  onClose(): void
}

/**
 * The Session's "Add exercise" picker (E19-T13, O23): a forgiving search (`matchesQuery`) over
 * the library, one tappable row per Exercise.
 */
export function ExercisePicker({ library, taken, onPick, onClose }: ExercisePickerProps): JSX.Element {
  const [query, setQuery] = useState('')
  const shown = library.filter((entry) => !taken.includes(entry.id) && matchesQuery(entry.name, query))

  return (
    <div role="dialog" aria-modal="true" aria-label="Add exercise" className="overlay-panel exercise-picker">
      <div className="exercise-picker-header">
        <h2 className="exercise-picker-heading">Add exercise</h2>
        <button type="button" className="exercise-picker-close btn-quiet" onClick={onClose}>
          Close
        </button>
      </div>
      <input
        type="search"
        aria-label="Search exercises"
        className="exercise-picker-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <ul className="exercise-picker-rows">
        {shown.map((entry) => (
          <li key={entry.id} className="exercise-picker-row">
            <button type="button" className="exercise-picker-pick cell" onClick={() => onPick(entry.id)}>
              {entry.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
