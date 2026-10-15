// E18-T3 [O5 O6 O7]: records (R-R), the one record count, the per-lift bests table (R-B).
// Pure; imports only src/domain/** and src/types.ts.
//
// Exported contract (chosen by the test-designer, documented here and in the tests):
//   computeRecords(sessions, resolve, planOf) -> SessionRecord[]  (flat; ascending startedAt)
//   recordCount(records, sessionId)           -> number  (the ONE count: live strip, summary,
//                                                Sessions row)
//   liftBests(history)                        -> BestRow[]  (R-B rows in the order of R-B)
// Inputs are the same as liftHistory.ts. Sessions passed are live ones (callers filter deleted).
// Kind of lift for R-B: loaded; assisted (Bodyweight whose latest Session top lever < 0);
// Bodyweight with Load (any positive lever so far); plain Bodyweight.
// "current lever" in `Most reps at <lever>` is the top lever of the lift's latest non-deload
// Session; its label uses `BW+5` / `BW−19` (U+2212) / `62.5 kg`.
import type { Session } from '../../types'
import type { Resolve } from '../muscles'
import { buildLiftHistories, leverOf, straightSets } from './liftHistory'
import type { LiftHistory, PlanOf } from './liftHistory'

export type RecordKindName =
  | 'Heaviest weight'
  | 'Least assistance'
  | 'First added load'
  | 'Rep record'
  | 'Estimated 1RM'

export type SessionRecord = {
  exerciseId: string
  sessionId: string
  kind: RecordKindName
  /** The set that set it: lever and reps (lever is the straight set's R-L lever). */
  lever: number
  reps: number
  /** Unrounded e1RM, present only for kind 'Estimated 1RM'. */
  e1rm?: number
  /** Positive magnitude: kg (weight kinds, 1RM) or reps (Rep record). `−2 kg assistance` is 2. */
  gain: number
  /** Lower-ranked kinds also beaten that Session: readout only, never counted. */
  alsoBeat: { kind: RecordKindName; gain: number }[]
}

export type BestRow = {
  /** `Heaviest set`, `Best estimated 1RM`, `Least assistance`, `Heaviest added load`,
   * `Most reps, bodyweight only`, `Most reps in a set`, `Most reps at <lever>`. */
  label: string
  lever?: number
  reps?: number
  e1rm?: number
  /** Session startedAt of the best (ties go to the earliest). */
  at: number
}

const MIN_E1RM_GAIN = 0.5

type Candidate = { kind: RecordKindName; lever: number; reps: number; e1rm?: number; gain: number }

/** One lift's records, in Session order. R-R: first match wins; lower kinds kept as alsoBeat. */
function recordsOfLift(history: LiftHistory): SessionRecord[] {
  const out: SessionRecord[] = []
  let bestLever = -Infinity
  const repsAt = new Map<number, number>()
  let bestE1rm: number | null = null
  history.points.forEach((point, i) => {
    const straight = straightSets(point.workingSets)
    if (i > 0 && !point.deload && point.top) {
      const found: Candidate[] = []
      const { lever, reps } = point.top
      if (lever > bestLever) {
        const kind: RecordKindName =
          lever < 0
            ? 'Least assistance'
            : history.bodyweight && bestLever <= 0 && lever > 0
              ? 'First added load'
              : 'Heaviest weight'
        found.push({ kind, lever, reps, gain: kind === 'First added load' ? lever : lever - bestLever })
      }
      let rep: Candidate | undefined
      for (const s of straight) {
        const l = leverOf(s, history.bodyweight)
        const before = repsAt.get(l)
        if (before === undefined || s.reps <= before) continue
        if (!rep || l > rep.lever || (l === rep.lever && s.reps > rep.reps)) {
          rep = { kind: 'Rep record', lever: l, reps: s.reps, gain: s.reps - before }
        }
      }
      if (rep) found.push(rep)
      if (point.e1rm !== null && bestE1rm !== null && point.e1rm >= bestE1rm + MIN_E1RM_GAIN) {
        found.push({ kind: 'Estimated 1RM', lever, reps, e1rm: point.e1rm, gain: point.e1rm - bestE1rm })
      }
      if (found.length > 0) {
        const [first, ...rest] = found
        out.push({
          exerciseId: history.exerciseId,
          sessionId: point.sessionId,
          kind: first.kind,
          lever: first.lever,
          reps: first.reps,
          ...(first.e1rm !== undefined ? { e1rm: first.e1rm } : {}),
          gain: first.gain,
          alsoBeat: rest.map((c) => ({ kind: c.kind, gain: c.gain })),
        })
      }
    }
    for (const s of straight) {
      const l = leverOf(s, history.bodyweight)
      if (l > bestLever) bestLever = l
      if (s.reps > (repsAt.get(l) ?? -1)) repsAt.set(l, s.reps)
    }
    if (point.e1rm !== null && (bestE1rm === null || point.e1rm > bestE1rm)) bestE1rm = point.e1rm
  })
  return out
}

export function computeRecords(
  sessions: Session[],
  resolve: Resolve,
  planOf: PlanOf,
): SessionRecord[] {
  const order = new Map<string, number>()
  for (const s of sessions) order.set(s.id, s.startedAt)
  const out: SessionRecord[] = []
  for (const history of buildLiftHistories(sessions, resolve, planOf).values()) {
    out.push(...recordsOfLift(history))
  }
  return out.sort((a, b) => (order.get(a.sessionId) ?? 0) - (order.get(b.sessionId) ?? 0))
}

/** The one count of a Session's records (live strip, summary, Sessions row). */
export function recordCount(records: SessionRecord[], sessionId: string): number {
  return records.filter((r) => r.sessionId === sessionId).length
}

function leverLabel(lever: number): string {
  if (lever === 0) return 'BW'
  return lever > 0 ? `BW+${lever}` : `BW−${Math.abs(lever)}`
}

type Hit = { lever: number; reps: number; at: number }

/** The best Hit under `better`; the first (earliest) one wins a tie. */
function bestOf(hits: Hit[], better: (a: Hit, b: Hit) => boolean): Hit | undefined {
  let best: Hit | undefined
  for (const h of hits) if (!best || better(h, best)) best = h
  return best
}

export function liftBests(history: LiftHistory): BestRow[] {
  const hits: Hit[] = []
  for (const p of history.points) {
    for (const s of straightSets(p.workingSets)) {
      hits.push({ lever: leverOf(s, history.bodyweight), reps: s.reps, at: p.startedAt })
    }
  }
  const byLeverThenReps = (a: Hit, b: Hit) =>
    a.lever > b.lever || (a.lever === b.lever && (a.reps > b.reps || (a.reps === b.reps && a.at < b.at)))
  const byReps = (a: Hit, b: Hit) => a.reps > b.reps || (a.reps === b.reps && a.at < b.at)
  const row = (label: string, h: Hit | undefined): BestRow[] =>
    h ? [{ label, lever: h.lever, reps: h.reps, at: h.at }] : []
  const atLever = (lever: number) => hits.filter((h) => h.lever === lever)

  if (!history.bodyweight) {
    const rows = row('Heaviest set', bestOf(hits, byLeverThenReps))
    if (history.e1rmLift) {
      let best: { e1rm: number; at: number } | undefined
      for (const p of history.points) {
        if (p.e1rm !== null && (!best || p.e1rm > best.e1rm)) best = { e1rm: p.e1rm, at: p.startedAt }
      }
      if (best) rows.push({ label: 'Best estimated 1RM', e1rm: best.e1rm, at: best.at })
    }
    return rows
  }

  const current = [...history.points].reverse().find((p) => !p.deload && p.top)?.top ?? null
  const currentRow = (): BestRow[] =>
    current ? row(`Most reps at ${leverLabel(current.lever)}`, bestOf(atLever(current.lever), byReps)) : []
  const lastTop = [...history.points].reverse().find((p) => p.top)?.top ?? null
  if (lastTop && lastTop.lever < 0) {
    return [...row('Least assistance', bestOf(hits, byLeverThenReps)), ...currentRow()]
  }
  if (hits.some((h) => h.lever > 0)) {
    return [
      ...row('Heaviest added load', bestOf(hits, byLeverThenReps)),
      ...row('Most reps, bodyweight only', bestOf(atLever(0), byReps)),
      ...currentRow(),
    ]
  }
  return row('Most reps in a set', bestOf(hits, byReps))
}
