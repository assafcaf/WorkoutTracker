import type { LibraryExercise, Muscle, Program } from '../types'
import type { Resolve } from './muscles'
import { plannedPerWeek, STATS_MUSCLES } from './stats/muscles'

/** The weekly set range per muscle that counts as "within" (R-S). */
export const WEEKLY_SET_RANGE = { min: 10, max: 20 } as const

export type Standing = 'below' | 'within' | 'above'

export type PlannedRange = { muscle: Muscle; planned: number; standing: Standing }

/** The 12 STATS_MUSCLES in order: planned sets per week (rounded half up) and its standing against the range. */
export function plannedAgainstRange(
  program: Program,
  resolve: Resolve,
  library: Map<string, LibraryExercise>,
): PlannedRange[] {
  const perWeek = plannedPerWeek(program, resolve, library)
  return STATS_MUSCLES.map((muscle) => {
    const planned = Math.floor((perWeek.get(muscle) ?? 0) + 0.5)
    const standing: Standing =
      planned < WEEKLY_SET_RANGE.min ? 'below' : planned > WEEKLY_SET_RANGE.max ? 'above' : 'within'
    return { muscle, planned, standing }
  })
}
