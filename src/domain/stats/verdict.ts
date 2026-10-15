// E18-T5 [O8 O9 O10]: verdicts (R-V), next step (R-N), steps climbed (R-S).
// Pure; imports only src/domain/** and src/types.ts.
//
// Exported contract (chosen by the test-designer, documented here and in the tests):
//   verdictOf(history, records, now)        -> Verdict   (one lift; deload Sessions skipped)
//   verdicts(histories, records, now)       -> Map<exerciseId, Verdict>
//   nextStep(history, plan, exercise)       -> NextStep | null
//   stepsClimbed(histories, records, now)   -> StepsClimbed
// `records` is computeRecords(...) output (all lifts). `now` is epoch ms; "today" is its local day.
import type { Exercise, ExercisePlan } from '../../types'
import { leverOf, straightSets } from './liftHistory'
import type { LiftHistory } from './liftHistory'
import type { SessionRecord } from './records'

export type VerdictKind = 'moving' | 'stalled' | 'slipping' | 'too new'

export type Verdict = {
  kind: VerdictKind
  /** Non-deload Sessions of the lift. */
  n: number
  /** 'too new' only: `4 - n`. */
  more?: number
  /** 'stalled' only: startedAt of the last record's Session, or of the baseline when none. */
  since?: number
  /** 'stalled' only: non-deload Sessions after `since`. */
  sessionsSince?: number
  /** 'stalled' only: unrounded weeks from `since` to `now`. */
  weeks?: number
  /** 'slipping' only: the best top set of the Sessions before the last 2, and its Session's startedAt. */
  bestBefore?: { lever: number; reps: number; startedAt: number }
}

export type NextStep = {
  /** Reps done in the latest Session's straight sets at its top lever. */
  repsAtTop: number
  /** Straight sets done at the top lever x top of the Plan's rep range. */
  target: number
  /** The latest Session's top lever (R-L). */
  lever: number
  ready: boolean
  /** Only when ready: one step up in lever, or one more set for a plain Bodyweight lift. */
  suggest?: { kind: 'lever'; lever: number } | { kind: 'set' }
}

export type StepsClimbed = {
  climbed: number
  /** Lifts with a history. */
  of: number
  /** Local midnight of the first of the 28 days ending today. */
  since: number
  /** The lifts that climbed, sorted. */
  ids: string[]
}

const WEEK_MS = 7 * 24 * 3600 * 1000
const CLIMB_KINDS: ReadonlySet<SessionRecord['kind']> = new Set([
  'Heaviest weight',
  'Least assistance',
  'First added load',
])

type Top = { lever: number; reps: number }
const below = (a: Top, b: Top) => a.lever < b.lever || (a.lever === b.lever && a.reps < b.reps)

export function verdictOf(history: LiftHistory, records: SessionRecord[], now: number): Verdict {
  const pts = history.points.filter((p) => !p.deload)
  const n = pts.length
  if (n < 4) return { kind: 'too new', n, more: 4 - n }

  const [prev, last] = [pts[n - 2], pts[n - 1]]
  if (prev.top && last.top) {
    let best: { top: Top; startedAt: number } | null = null
    for (let i = Math.max(0, n - 6); i <= n - 3; i += 1) {
      const top = pts[i].top
      if (!top) continue
      if (!best || top.lever > best.top.lever || (top.lever === best.top.lever && top.reps > best.top.reps)) {
        best = { top, startedAt: pts[i].startedAt }
      }
    }
    if (best && below(prev.top, best.top) && below(last.top, best.top)) {
      return {
        kind: 'slipping',
        n,
        bestBefore: { lever: best.top.lever, reps: best.top.reps, startedAt: best.startedAt },
      }
    }
  }

  const recorded = new Set(
    records.filter((r) => r.exerciseId === history.exerciseId).map((r) => r.sessionId),
  )
  if (pts.slice(-4).some((p) => recorded.has(p.sessionId))) return { kind: 'moving', n }

  let at = 0
  for (let i = n - 1; i >= 0; i -= 1) {
    if (recorded.has(pts[i].sessionId)) {
      at = i
      break
    }
  }
  const since = pts[at].startedAt
  return { kind: 'stalled', n, since, sessionsSince: n - 1 - at, weeks: (now - since) / WEEK_MS }
}

export function verdicts(
  histories: Map<string, LiftHistory>,
  records: SessionRecord[],
  now: number,
): Map<string, Verdict> {
  const out = new Map<string, Verdict>()
  for (const [id, h] of histories) out.set(id, verdictOf(h, records, now))
  return out
}

export function nextStep(
  history: LiftHistory,
  plan: ExercisePlan | undefined,
  exercise: Exercise,
): NextStep | null {
  const latest = history.points.at(-1)
  if (!plan || !latest || !latest.top) return null
  const lever = latest.top.lever
  const atTop = straightSets(latest.workingSets).filter(
    (s) => leverOf(s, history.bodyweight) === lever,
  )
  const repsAtTop = atTop.reduce((sum, s) => sum + s.reps, 0)
  const target = atTop.length * plan.repRange[1]
  const ready = repsAtTop >= target
  const step: NextStep = { repsAtTop, target, lever, ready }
  if (ready) {
    step.suggest =
      history.bodyweight && lever === 0
        ? { kind: 'set' }
        : { kind: 'lever', lever: Math.round((lever + exercise.weightStep) * 100) / 100 }
  }
  return step
}

export function stepsClimbed(
  histories: Map<string, LiftHistory>,
  records: SessionRecord[],
  now: number,
): StepsClimbed {
  const today = new Date(now)
  const since = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 27).getTime()
  const ids: string[] = []
  for (const [id, h] of histories) {
    const startedAt = new Map(h.points.map((p) => [p.sessionId, p.startedAt]))
    const climbed = records.some((r) => {
      if (r.exerciseId !== id || !CLIMB_KINDS.has(r.kind)) return false
      const at = startedAt.get(r.sessionId)
      return at !== undefined && at >= since
    })
    if (climbed) ids.push(id)
  }
  ids.sort()
  return { climbed: ids.length, of: histories.size, since, ids }
}
