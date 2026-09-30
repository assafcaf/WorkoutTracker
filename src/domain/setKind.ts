import type { SetEntry } from '../types'

/** Stub (E14-T1): whether a Set counts toward stats. Not yet implemented. */
export function countsTowardStats(_entry: SetEntry): boolean {
  return true
}

export function workingSets(entries: SetEntry[]): SetEntry[] {
  return entries.filter(countsTowardStats)
}
