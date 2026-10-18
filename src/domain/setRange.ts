import type { LibraryExercise, Muscle, Program } from '../types'
import type { Resolve } from './muscles'

/** The weekly set range per muscle that counts as "within" (R-S). */
export const WEEKLY_SET_RANGE = { min: 10, max: 20 } as const

export type Standing = 'below' | 'within' | 'above'

export type PlannedRange = { muscle: Muscle; planned: number; standing: Standing }

/** The 12 STATS_MUSCLES in order: planned sets per week (rounded half up) and its standing against the range. */
export function plannedAgainstRange(
  _program: Program,
  _resolve: Resolve,
  _library: Map<string, LibraryExercise>,
): PlannedRange[] {
  throw new Error('NotImplementedError')
}
