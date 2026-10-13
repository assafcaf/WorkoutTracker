import type { Session, SetEntry } from '../types'

/**
 * The Set in today's shape: an assisted pull-up stored before E16 at a positive `weightKg`
 * reads as Bodyweight with that weight as a negative Load (E16-T3).
 */
export function normalizeLegacySet(entry: SetEntry): SetEntry {
  void entry
  throw new Error('not implemented: normalizeLegacySet (E16-T3)')
}

/** The Session with every Set normalised by `normalizeLegacySet`, its own fields unchanged. */
export function normalizeLegacySession(session: Session): Session {
  void session
  throw new Error('not implemented: normalizeLegacySession (E16-T3)')
}
