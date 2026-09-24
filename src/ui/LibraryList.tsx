import { useEffect, useRef, useState } from 'react'
import type { LibraryExercise, Muscle } from '../types'
import './LibraryList.css'

/** Rows per page of the Previous/Next pager (O16-O18). */
const PAGE_SIZE = 10

export type LibraryListProps = {
  library: LibraryExercise[]
  /** Opens an exercise's detail screen. Wired to a no-op by App in E5-T3; E5-T8 wires it up. */
  onOpen(id: string): void
  /**
   * The gym's saved equipment, or `null` when nothing has been saved -- filters the list to it
   * while the "My gym only" chip is on (E5-T16).
   */
  gymEquipment: string[] | null
  /**
   * The muscles a region panel's "Browse exercises" opened the tab on (E5-T20, M9): when given
   * and non-empty, only exercises with at least one of them among `primaryMuscles` are listed.
   */
  initialMuscles?: Muscle[]
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
 * uses (src/domain/alternatives.ts). `initialMuscles` (E5-T20), when non-empty, further keeps
 * only exercises primary in at least one of them.
 */
export function LibraryList({
  library,
  onOpen,
  gymEquipment,
  initialMuscles,
}: LibraryListProps): JSX.Element {
  const [gymOnly, setGymOnly] = useState(true)
  const [page, setPage] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const passesEquipment = (exercise: LibraryExercise): boolean => {
    if (exercise.equipment === null || exercise.equipment === 'body only') return true
    if (gymEquipment === null) return true
    return gymEquipment.includes(exercise.equipment)
  }

  const passesMuscles = (exercise: LibraryExercise): boolean =>
    initialMuscles === undefined ||
    initialMuscles.length === 0 ||
    exercise.primaryMuscles.some((muscle) => initialMuscles.includes(muscle))

  const filtered = library.filter(
    (exercise) =>
      passesMuscles(exercise) && (!gymOnly || gymEquipment === null || passesEquipment(exercise)),
  )
  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name))

  // Whenever the filtered/sorted result itself changes -- a new `library` prop (App's search/
  // muscle/equipment filters), `gymOnly`, or `initialMuscles` -- the pager resets back to page 1,
  // keyed on the sorted ids rather than array identity so a same-content re-filter (e.g. toggling
  // gymOnly back) also resets (O18).
  const sortedKey = sorted.map((exercise) => exercise.id).join(',')
  const previousKey = useRef(sortedKey)
  useEffect(() => {
    if (previousKey.current !== sortedKey) {
      previousKey.current = sortedKey
      setPage(0)
    }
  }, [sortedKey])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const visible = sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

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
        <>
          <ul className="library-list" ref={listRef}>
            {visible.map((exercise) => (
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
          <nav aria-label="Pages" className="library-pager">
            <button
              type="button"
              className="library-pager-button"
              disabled={page === 0}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </button>
            <span aria-live="polite">
              Page {page + 1} of {totalPages}
            </span>
            <button
              type="button"
              className="library-pager-button"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </nav>
        </>
      )}
    </div>
  )
}
