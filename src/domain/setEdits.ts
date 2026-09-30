import type { SetEntry } from '../types'

/**
 * Removes one Set of an Exercise and renumbers that Exercise's later Sets down by one.
 * Returns the remaining entries and the removed one. Pure.
 */
export function removeSet(
  entries: SetEntry[],
  exerciseId: string,
  setIndex: number,
): { entries: SetEntry[]; removed: SetEntry } {
  const at = entries.findIndex(
    (entry) => entry.exerciseId === exerciseId && entry.setIndex === setIndex,
  )
  if (at < 0) throw new Error(`no set ${setIndex} of ${exerciseId} is logged`)
  const rest = entries
    .filter((_, position) => position !== at)
    .map((entry) =>
      entry.exerciseId === exerciseId && entry.setIndex > setIndex
        ? { ...entry, setIndex: entry.setIndex - 1 }
        : entry,
    )
  return { entries: rest, removed: entries[at] }
}

/**
 * Puts a Set back: that Exercise's Sets at or past `entry.setIndex` move up by one, then the
 * entry is inserted. Pure.
 */
export function insertSet(entries: SetEntry[], entry: SetEntry): SetEntry[] {
  const shifted = entries.map((stored) =>
    stored.exerciseId === entry.exerciseId && stored.setIndex >= entry.setIndex
      ? { ...stored, setIndex: stored.setIndex + 1 }
      : stored,
  )
  const before = shifted.findIndex(
    (stored) => stored.exerciseId === entry.exerciseId && stored.setIndex > entry.setIndex,
  )
  if (before < 0) return [...shifted, entry]
  return [...shifted.slice(0, before), entry, ...shifted.slice(before)]
}
