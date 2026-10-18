// E18-T6 [O16 O17]: the Progression Ladder as pure data (treads, off-tread deload points, labelled
// gaps, rep bars with target), its range cuts and the `4 weeks ago` compare.
import type { Program, Session } from '../../types'
import { leverOf, straightSets, type LiftHistory, type LiftPoint } from './liftHistory'
import { weekStart } from './weeks'
import type { Weekday } from './weeks'

export type LadderPoint = {
  sessionId: string
  startedAt: number
  deload: boolean
  /** R-T top lever of the Session. */
  lever: number
  /** Reps of the straight sets at the top lever, summed (the rep bar). */
  reps: number
  /** Straight sets at the top lever x the top of the Plan's range; null with no Plan or on a deload point. */
  target: number | null
}

export type Tread = {
  lever: number
  /** The target of the tread's latest point; null when the lift has no Plan. */
  target: number | null
  /** Non-deload Sessions on the tread, oldest first. */
  sessionIds: string[]
}

export type LadderGap = {
  /** Monday 00:00 local (R-K) of a calendar week with no Session of the lift. */
  weekStart: number
  /** `No sessions`, or `No <workout> session` (`A` from `Workout A`) when other Sessions exist. */
  label: string
}

export type Ladder = {
  exerciseId: string
  treads: Tread[]
  /** Every point, deload ones included, oldest first. */
  points: LadderPoint[]
  gaps: LadderGap[]
}

export type LadderRange = 'step' | '3M' | '1Y' | 'all'

export type LadderContext = {
  /** All Sessions (to tell an empty week from one where only another workout was done). */
  sessions: Session[]
  program: Program | undefined
}

export type Compare = {
  then: { sessionId: string; startedAt: number; lever: number; reps: number }
  now: { sessionId: string; startedAt: number; lever: number; reps: number }
  change: 'up' | 'same' | 'down'
}

const DAY = 86_400_000

function planFor(program: Program | undefined, exerciseId: string) {
  for (const w of program?.workouts ?? []) {
    const plan = w.exercises.find((e) => e.exerciseId === exerciseId)
    if (plan) return { plan, workout: w }
  }
  return undefined
}

function nextWeek(start: number): number {
  const d = new Date(start)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7).getTime()
}

/** Treads, off-tread deload points, labelled gaps and rep bars with target for one lift. */
export function buildLadder(history: LiftHistory, ctx: LadderContext, _weekStartsOn: Weekday = 1): Ladder {
  const found = planFor(ctx.program, history.exerciseId)
  const points: LadderPoint[] = []
  const treads: Tread[] = []
  let last: Tread | undefined
  for (const p of history.points) {
    if (!p.top) continue
    const lever = p.top.lever
    const atTop = straightSets(p.workingSets).filter((s) => leverOf(s, history.bodyweight) === lever)
    const reps = atTop.reduce((n, s) => n + s.reps, 0)
    const target = p.deload || !found ? null : atTop.length * found.plan.repRange[1]
    points.push({ sessionId: p.sessionId, startedAt: p.startedAt, deload: p.deload, lever, reps, target })
    if (p.deload) continue
    if (last && last.lever === lever) {
      last.sessionIds.push(p.sessionId)
      last.target = target
    } else {
      last = { lever, target, sessionIds: [p.sessionId] }
      treads.push(last)
    }
  }

  const gaps: LadderGap[] = []
  if (points.length > 0) {
    const have = new Set(points.map((p) => weekStart(p.startedAt)))
    const anyDone = new Set(
      ctx.sessions.filter((s) => s.deletedAt === undefined).map((s) => weekStart(s.startedAt)),
    )
    const name = found?.workout.name.replace(/^Workout\s+/i, '')
    const end = weekStart(points[points.length - 1].startedAt)
    for (let w = weekStart(points[0].startedAt); w <= end; w = nextWeek(w)) {
      if (have.has(w)) continue
      gaps.push({ weekStart: w, label: anyDone.has(w) && name ? `No ${name} session` : 'No sessions' })
    }
  }
  return { exerciseId: history.exerciseId, treads, points, gaps }
}

/** Cuts a ladder to a range: Step (current tread and two before) or by date. Pure. */
export function cutLadder(ladder: Ladder, range: LadderRange, now: number, _weekStartsOn: Weekday = 1): Ladder {
  if (range === '1Y' || range === 'all') return ladder
  let from: number
  if (range === 'step') {
    const keep = ladder.treads.slice(-3)
    if (keep.length === 0) return ladder
    const first = ladder.points.find((p) => p.sessionId === keep[0].sessionIds[0])
    if (!first) return ladder
    from = first.startedAt
  } else {
    const d = new Date(now)
    from = new Date(d.getFullYear(), d.getMonth() - 3, d.getDate(), d.getHours(), d.getMinutes()).getTime()
  }
  const points = ladder.points.filter((p) => p.startedAt >= from)
  const ids = new Set(points.map((p) => p.sessionId))
  const treads = ladder.treads
    .map((t) => ({ ...t, sessionIds: t.sessionIds.filter((id) => ids.has(id)) }))
    .filter((t) => t.sessionIds.length > 0)
  const gapFrom = weekStart(from)
  return { ...ladder, points, treads, gaps: ladder.gaps.filter((g) => g.weekStart >= gapFrom) }
}

/** Top set `weeks` weeks ago against the latest one; null before the 4th non-deload Session. */
export function compareAgo(history: LiftHistory, now: number, weeks = 4): Compare | null {
  const real = history.points.filter((p): p is LiftPoint & { top: NonNullable<LiftPoint['top']> } => !p.deload && p.top !== null)
  if (real.length < 4) return null
  const cut = now - weeks * 7 * DAY
  const before = real.filter((p) => p.startedAt <= cut)
  const t = before[before.length - 1]
  const n = real[real.length - 1]
  if (!t) return null
  const side = (p: typeof t) => ({ sessionId: p.sessionId, startedAt: p.startedAt, lever: p.top.lever, reps: p.top.reps })
  const then = side(t)
  const cur = side(n)
  const diff = cur.lever !== then.lever ? cur.lever - then.lever : cur.reps - then.reps
  return { then, now: cur, change: diff > 0 ? 'up' : diff < 0 ? 'down' : 'same' }
}
