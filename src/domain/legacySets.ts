import type { Session, SetEntry } from '../types'

/** The Exercise whose assistance was stored as a positive `weightKg` before E16. */
const ASSISTED_PULL_UPS = 'assisted-pull-ups'

/**
 * The Set in today's shape: an assisted pull-up stored before E16 at a positive `weightKg`
 * reads as Bodyweight with that weight as a negative Load (E16-T3).
 */
export function normalizeLegacySet(entry: SetEntry): SetEntry {
  if (entry.exerciseId !== ASSISTED_PULL_UPS || entry.weightKg === null || entry.weightKg < 0) {
    return entry
  }
  // A stored 0 was no assistance at all: plain Bodyweight, with no Load.
  if (entry.weightKg === 0) return { ...entry, weightKg: null }
  return { ...entry, weightKg: null, loadKg: -entry.weightKg }
}

/** The Session with every Set normalised by `normalizeLegacySet`, its own fields unchanged. */
export function normalizeLegacySession(session: Session): Session {
  return { ...session, entries: session.entries.map(normalizeLegacySet) }
}
