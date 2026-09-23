import { useState } from 'react'
import type { LibraryExercise } from '../types'
import './LibraryList.css'

export type LibraryListProps = {
  library: LibraryExercise[]
  /** Opens an exercise's detail screen. Wired to a no-op by App in E5-T3; E5-T8 wires it up. */
  onOpen(id: string): void
  /**
   * The gym's saved equipment, or `null` when nothing has been saved -- filters the list to it
   * while the "My gym only" chip is on (E5-T16).
   */
  gymEquipment: string[] | null
}

/**
 * The library exercises given, sorted by name and rendered one row per exercise, each showing
 * its name and primary muscle.
 *
 * `library` is not filtered here: per E5-T3's ticket, the search box and the muscle/equipment
 * filters live in `App.tsx`, which passes this component an already-filtered array.
 *
 * The "My gym only" chip (E5-T16) defaults to on and, while on and `gymEquipment` is not
 * `null`, filters `library` down to exercises whose equipment is in `gymEquipment` -- an
 * exercise with no equipment or `body only` always passes, the same predicate `alternativesFor`
 * uses (src/domain/alternatives.ts).
 */
export function LibraryList({ library, onOpen, gymEquipment }: LibraryListProps): JSX.Element {
  const [gymOnly, setGymOnly] = useState(true)

  const passesEquipment = (exercise: LibraryExercise): boolean => {
    if (exercise.equipment === null || exercise.equipment === 'body only') return true
    if (gymEquipment === null) return true
    return gymEquipment.includes(exercise.equipment)
  }

  const filtered = gymOnly && gymEquipment !== null ? library.filter(passesEquipment) : library
  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="library-list-container">
      <button
        type="button"
        className="library-gym-only-chip"
        aria-pressed={gymOnly}
        onClick={() => setGymOnly((current) => !current)}
      >
        My gym only
      </button>
      {sorted.length === 0 ? (
        <p>No exercises match</p>
      ) : (
        <ul className="library-list">
          {sorted.map((exercise) => (
            <li key={exercise.id} className="library-row">
              <button
                type="button"
                className="library-row-button"
                onClick={() => onOpen(exercise.id)}
              >
                <span className="library-row-name">{exercise.name}</span>
                <span className="library-row-muscle">{exercise.primaryMuscles[0]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
