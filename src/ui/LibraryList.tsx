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
 * STUB for E5-T3's red commit -- test-designer only. The real component (E5-T3's code-writer):
 * - sorts `library` by `name`, locale/case-insensitively (`localeCompare`, not a raw `<` sort:
 *   see the "case-insensitively rather than by raw code point" test in `LibraryList.test.tsx`);
 * - renders one `<li>` per exercise (so `screen.getAllByRole('listitem')` counts them), each
 *   carrying a `.library-row-name` element with the exercise's name and a `.library-row-muscle`
 *   element with its first primary muscle -- the exact selectors `LibraryList.test.tsx` reads
 *   rows through.
 *
 * `library` is not filtered here: per E5-T3's ticket, the search box and the muscle/equipment
 * filters live in `App.tsx`, which passes this component an already-filtered array.
 */
export function LibraryList(_props: LibraryListProps): JSX.Element {
  return <ul className="library-list" />
}
