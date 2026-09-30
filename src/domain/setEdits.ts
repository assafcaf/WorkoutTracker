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
  throw new Error(`not implemented: removeSet(${entries.length}, ${exerciseId}, ${setIndex})`)
}

/**
 * Puts a Set back: that Exercise's Sets at or past `entry.setIndex` move up by one, then the
 * entry is inserted. Pure.
 */
export function insertSet(entries: SetEntry[], entry: SetEntry): SetEntry[] {
  throw new Error(`not implemented: insertSet(${entries.length}, ${entry.exerciseId})`)
}
