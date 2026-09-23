import type { LibraryExercise } from '../types'
import './LibraryList.css'

export type LibraryListProps = {
  library: LibraryExercise[]
  /** Opens an exercise's detail screen. Wired to a no-op by App in E5-T3; E5-T8 wires it up. */
  onOpen(id: string): void
}

/**
 * The library exercises given, sorted by name and rendered one row per exercise, each showing
 * its name and primary muscle.
 *
 * `library` is not filtered here: per E5-T3's ticket, the search box and the muscle/equipment
 * filters live in `App.tsx`, which passes this component an already-filtered array.
 */
export function LibraryList({ library, onOpen }: LibraryListProps): JSX.Element {
  const sorted = [...library].sort((a, b) => a.name.localeCompare(b.name))

  return (
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
  )
}
