// E22-T4 [O10 O11]: the Last week card's numbers (pure). Words and signs are the Home card's.
import type { BodyLog, Session } from '../../types'
import type { Resolve } from '../muscles'
import type { PlanOf } from './liftHistory'
import { bodyweightOn } from '../bodyLog'
import { workingSets } from '../setKind'
import { sessionVolume } from '../volume'
import { computeRecords, recordCount } from './records'
import { weekStart } from './weeks'
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

function prevWeek(start: number): number {
  const d = new Date(start)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7).getTime()
}

export function lastWeekCard(
  sessions: Session[],
  now: number,
  resolve: Resolve,
  planOf: PlanOf,
  weekStartsOn: Weekday,
  log: BodyLog,
): LastWeekCard | null {
  const live = sessions.filter((s) => s.deletedAt === undefined && s.finishedAt !== null)
  const end = weekStart(now, weekStartsOn)
  const start = prevWeek(end)
  const beforeStart = prevWeek(start)
  const records = computeRecords(
    live.filter((s) => s.startedAt < end),
    resolve,
    planOf,
  )
  const totals = (from: number, to: number): WeekTotals => {
    const inWeek = live.filter((s) => s.startedAt >= from && s.startedAt < to)
    let sets = 0
    let volumeKg = 0
    let prs = 0
    for (const s of inWeek) {
      sets += workingSets(s.entries).length
      volumeKg += sessionVolume(s, resolve, bodyweightOn(log, s.startedAt)?.kg ?? null).kg
      prs += recordCount(records, s.id)
    }
    return { sessions: inWeek.length, sets, volumeKg, prs }
  }
  const last = totals(start, end)
  const before = totals(beforeStart, start)
  if (last.sessions === 0 && before.sessions === 0) return null
  return { start, end, last, before }
}
