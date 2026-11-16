// v6: one lift's story in numbers -- the one measure its chart, its dashboard row and its lift page
// all draw, its change over a window, its records and its session log. Pure.
//
//   measureOf(history)                 -> 'est' (loaded: estimated max, kg) | 'load' (Bodyweight with
//                                         assistance or added load: the signed Load) | 'reps' (plain
//                                         Bodyweight: most reps in one set)
//   storyPoints(history)               -> one point per Session with a straight set, oldest first
//   measureText(measure, value, bw)    -> '79.2 kg' | 'BW−19' | '17 reps'
//   changeSince(points, from)          -> the change from the first non-deload point at or after
//                                         `from` to the latest one, or null with fewer than 2
//   changeText(measure, delta)         -> '+8.3 kg' | '+2 reps' | 'no change'
//   changeTextFor(history, delta)      -> the same, but an assisted lift reads '1.5 kg less assistance'
//   liftRecordRows(history)            -> heaviest set, best est. strength, most reps at the current load
//   sessionLog(history)                -> newest first, with the PR each Session set (records.ts)
import type { SetEntry } from '../../types'
import type { LiftHistory } from './liftHistory'
import { leverOf, straightSets } from './liftHistory'
import { liftPrs } from './records'
import type { LiftPr } from './records'
import { leverText, numberText, plural, topText } from './words'

export type Measure = 'est' | 'load' | 'reps'

export type StoryPoint = {
  sessionId: string
  at: number
  deload: boolean
  /** The measure's value for this Session. */
  value: number
  /** The Session's top set: its highest lever and the most reps at it. */
  top: { lever: number; reps: number }
  /** The top set as a chart label: `62.5×8`, `BW×17`, `BW−19×6`. */
  label: string
}

/** Estimated max (Epley): weight * (1 + reps / 30). */
export function estimatedMax(weight: number, reps: number): number {
  return weight * (1 + reps / 30)
}

export const EST_MAX_FORMULA = 'Est. strength ≈ weight × (1 + reps ÷ 30), from your best working set.'

/** Every straight set of `history` as levers, oldest Session first. */
function allLevers(history: LiftHistory): number[] {
  return history.points.flatMap((p) => straightSets(p.workingSets).map((s) => leverOf(s, history.bodyweight)))
}

export function measureOf(history: LiftHistory): Measure {
  if (!history.bodyweight) return 'est'
  return allLevers(history).some((lever) => lever !== 0) ? 'load' : 'reps'
}

/** `62.5×8`, `BW×17`, `BW−19×6`: a top set, compact. */
export function compactTop(top: { lever: number; reps: number }, bodyweight: boolean): string {
  const lever = bodyweight ? leverText(top.lever, true) : numberText(top.lever)
  return `${lever}×${top.reps}`
}

function valueOf(measure: Measure, sets: SetEntry[], bodyweight: boolean, top: { lever: number; reps: number }): number {
  if (measure === 'reps') return Math.max(...sets.map((s) => s.reps))
  if (measure === 'load') return top.lever
  return Math.max(...sets.map((s) => estimatedMax(leverOf(s, bodyweight), s.reps)))
}

export function storyPoints(history: LiftHistory): StoryPoint[] {
  const measure = measureOf(history)
  const out: StoryPoint[] = []
  for (const p of history.points) {
    const sets = straightSets(p.workingSets)
    if (!p.top || sets.length === 0) continue
    out.push({
      sessionId: p.sessionId,
      at: p.startedAt,
      deload: p.deload,
      value: valueOf(measure, sets, history.bodyweight, p.top),
      top: p.top,
      label: compactTop(p.top, history.bodyweight),
    })
  }
  return out
}

const oneDecimal = (n: number): string => String(Math.round(n * 10) / 10)

export function measureText(measure: Measure, value: number, bodyweight: boolean): string {
  if (measure === 'reps') return plural(Math.round(value), 'rep')
  if (measure === 'load') return leverText(Math.round(value * 100) / 100, bodyweight)
  return `${oneDecimal(value)} kg`
}

/** What the measure is called: `est. strength`, `load`, `best set`. */
export function measureName(measure: Measure): string {
  if (measure === 'est') return 'est. strength'
  if (measure === 'load') return 'top load'
  return 'best set'
}

export type Change = { delta: number; since: number }

export function changeSince(points: StoryPoint[], from: number): Change | null {
  const real = points.filter((p) => !p.deload)
  const latest = real[real.length - 1]
  const first = real.find((p) => p.at >= from)
  if (!latest || !first || first === latest) return null
  return { delta: latest.value - first.value, since: first.at }
}

export function changeText(measure: Measure, delta: number): string {
  const size = Math.abs(delta)
  if (measure === 'reps') {
    const reps = Math.round(delta)
    return reps === 0 ? 'no change' : `${reps > 0 ? '+' : '−'}${plural(Math.abs(reps), 'rep')}`
  }
  if (Math.round(size * 10) === 0) return 'no change'
  return `${delta > 0 ? '+' : '−'}${oneDecimal(size)} kg`
}

/** An assisted lift's change reads in assistance: `1.5 kg less assistance`. */
export function changeTextFor(history: LiftHistory, delta: number): string {
  const measure = measureOf(history)
  const assisted = measure === 'load' && allLevers(history).every((lever) => lever <= 0)
  if (assisted) {
    const size = Math.abs(delta)
    if (Math.round(size * 10) === 0) return 'no change'
    return `${oneDecimal(size)} kg ${delta > 0 ? 'less' : 'more'} assistance`
  }
  return changeText(measure, delta)
}

/** A Records row: `Best est. strength` · `80 kg`, from `60 kg × 10` on its day. */
export type RecordRow = { label: string; value: string; detail?: string; at: number }

/**
 * The lift page's Records: `Heaviest set` (the highest lever, the most reps at it; `Least
 * assistance` or `Heaviest added load` on a Bodyweight lift; none on a plain one), `Best est. strength`
 * (loaded lifts planned for 10 reps or fewer, as records.ts measures it) and `Most reps in a
 * set`. Deload Sessions count; ties keep the earliest.
 */
export function liftRecordRows(history: LiftHistory): RecordRow[] {
  const bw = history.bodyweight
  const measure = measureOf(history)
  let heaviest: { lever: number; reps: number; at: number } | null = null
  let est: { lever: number; reps: number; value: number; at: number } | null = null
  let most: { lever: number; reps: number; at: number } | null = null
  // The current load: the latest non-deload Session's top lever.
  const current = history.points.filter((p) => !p.deload && p.top !== null).at(-1)?.top?.lever
  for (const p of history.points) {
    for (const s of straightSets(p.workingSets)) {
      const lever = leverOf(s, bw)
      if (!heaviest || lever > heaviest.lever || (lever === heaviest.lever && s.reps > heaviest.reps)) {
        heaviest = { lever, reps: s.reps, at: p.startedAt }
      }
      // The one rule's estimated max (records.ts): lifts planned for 10 reps or fewer, from sets
      // of 10 reps or fewer.
      const value = estimatedMax(lever, s.reps)
      if (history.e1rmLift && s.reps <= 10 && (!est || value > est.value)) est = { lever, reps: s.reps, value, at: p.startedAt }
      if ((measure === 'reps' || lever === current) && (!most || s.reps > most.reps)) {
        most = { lever, reps: s.reps, at: p.startedAt }
      }
    }
  }
  const rows: RecordRow[] = []
  if (heaviest && measure !== 'reps') {
    const label = !bw ? 'Heaviest set' : heaviest.lever <= 0 ? 'Least assistance' : 'Heaviest added load'
    rows.push({ label, value: topText(heaviest, bw), at: heaviest.at })
  }
  if (est) rows.push({ label: 'Best est. strength', value: `${oneDecimal(est.value)} kg`, detail: topText(est, bw), at: est.at })
  if (most) {
    const label = measure === 'reps' ? 'Most reps in a set' : `Most reps at ${leverText(most.lever, bw)}`
    rows.push({ label, value: plural(most.reps, 'rep'), at: most.at })
  }
  return rows
}

export type LogRow = {
  sessionId: string
  at: number
  deload: boolean
  /** The working Sets, in order. */
  sets: SetEntry[]
  /** The warm-ups, in order: shown, never counted. */
  warmups: SetEntry[]
  /** The Session's PR (the one rule, `liftPrs`) and the Set that set it, if any. */
  record: LiftPr | null
  /** The Session note, when there is one (added by the caller). */
  note?: string
}

export function sessionLog(history: LiftHistory): LogRow[] {
  const records = liftPrs(history)
  return history.points
    .filter((p) => p.workingSets.length > 0)
    .map((p) => ({
      sessionId: p.sessionId,
      at: p.startedAt,
      deload: p.deload,
      sets: p.workingSets,
      warmups: p.warmups,
      record: records.get(p.sessionId) ?? null,
    }))
    .reverse()
}
