import type { LibraryExercise, Muscle, Program } from '../types'
import type { Resolve } from './muscles'
import { plannedPerWeek, STATS_MUSCLES } from './stats/muscles'

/** The weekly set range per muscle that counts as "within" (R-S). */
export const WEEKLY_SET_RANGE = { min: 10, max: 20 } as const

export type Standing = 'below' | 'within' | 'above'

/**
 * Where a weekly set count sits against the range, judged on the whole number shown (half up):
 * 20.4 reads 20, within; 20.5 reads 21, above. The Muscles page and the Progress home's Muscles
 * row both judge with this, so they flag the same muscles (V3-12).
 */
export function weeklyStanding(sets: number): Standing {
  const shown = Math.round(sets)
  return shown < WEEKLY_SET_RANGE.min ? 'below' : shown > WEEKLY_SET_RANGE.max ? 'above' : 'within'
}

export type PlannedRange ={ muscle: Muscle; planned: number; standing: Standing }

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
