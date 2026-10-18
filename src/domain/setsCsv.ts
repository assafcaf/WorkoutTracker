import type { Exercise, Program, Session } from '../types'

export const SETS_CSV_HEADER = [
  'date',
  'program',
  'workout',
  'exercise',
  'set index',
  'kind',
  'weight kg',
  'reps',
  'rir',
  'e1RM',
  'session note',
]

/** The header plus one row per Set of every finished, live Session, oldest first (E23). */
export function setsCsvRows(_sessions: Session[], _programs: Program[], _exercises: Exercise[]): string[][] {
  throw new Error('not implemented')
}

/** The sets CSV as file text, BOM first. */
export function setsCsvText(_sessions: Session[], _programs: Program[], _exercises: Exercise[]): string {
  throw new Error('not implemented')
}

/** `workout-sets-YYYY-MM-DD.csv`, the local date of `now`. */
export function setsCsvFileName(_now: Date): string {
  throw new Error('not implemented')
}
