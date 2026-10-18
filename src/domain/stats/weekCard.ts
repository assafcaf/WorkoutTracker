// E22-T4 [O10 O11]: the Last week card's numbers (pure). Words and signs are the Home card's.
import type { BodyLog, Session } from '../../types'
import type { Resolve } from '../muscles'
import type { PlanOf } from './liftHistory'
import type { Weekday } from './weeks'

/** One week's four numbers: finished live Sessions, working Sets, volume in kg, PRs. */
export type WeekTotals = { sessions: number; sets: number; volumeKg: number; prs: number }

export type LastWeekCard = {
  /** Local midnight of the first day of last week (by `weekStartsOn`), epoch ms. */
  start: number
  /** Local midnight that follows its last day (exclusive): the start of `now`'s week. */
  end: number
  /** Last week. */
  last: WeekTotals
  /** The week before last week (all zeros when it had no Session). */
  before: WeekTotals
}

export function lastWeekCard(
  _sessions: Session[],
  _now: number,
  _resolve: Resolve,
  _planOf: PlanOf,
  _weekStartsOn: Weekday,
  _log: BodyLog,
): LastWeekCard | null {
  throw new Error('NotImplementedError')
}
