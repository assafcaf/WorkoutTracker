import type { SetEntry } from '../types'

/** Whether a Set counts toward stats: every Set except a warm-up. */
export function countsTowardStats(entry: SetEntry): boolean {
  return entry.kind !== 'warmup'
}

export function workingSets(entries: SetEntry[]): SetEntry[] {
  return entries.filter(countsTowardStats)
}
