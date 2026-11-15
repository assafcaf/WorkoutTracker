// The trend an Exercise's History leads with: one number per finished Session that folds the
// weight and the reps together, the Set that earned it, and whether it beat every earlier one.
// It charts what `seriesFor` charts (the same kinds, the same Epley), and adds the Set behind
// each point so the screen can say `70 × 8` rather than only `88.7 kg`.
import { epley, seriesFor, type SeriesKind } from './series'
import { countsTowardStats } from './setKind'
import type { Exercise, Session, SetEntry } from '../types'

export type TrendPoint = {
  sessionId: string
  /** The Session's start, epoch ms. */
  at: number
  /**
   * `e1rm`: the best working Set's Epley estimate, kg. `load`: the heaviest signed Load (less
   * assistance is higher). `reps`: the working Sets' reps added up.
   */
  value: number
  /** The working Set behind `value` (for `reps`, the Set with the most reps). */
  best: SetEntry
  /** Higher than every earlier point; never the first point, which has nothing to beat. */
  record: boolean
}

export type ExerciseTrend = { kind: SeriesKind; points: TrendPoint[] }

/** The best of `sets` by `score`; a tie keeps the heavier, then the earlier Set. */
function bestBy(sets: SetEntry[], score: (set: SetEntry) => number): SetEntry {
  let best = sets[0]
  for (const set of sets.slice(1)) {
    const a = score(set)
    const b = score(best)
    if (a > b || (a === b && (set.weightKg ?? set.loadKg ?? 0) > (best.weightKg ?? best.loadKg ?? 0))) best = set
  }
  return best
}

/**
 * `exercise`'s trend over the finished Sessions in `sessions`, oldest first. A loaded Exercise
 * charts e1RM; a Bodyweight one its signed Load once any Set carries one, else its total reps
 * (the kinds `seriesFor` picks). Warm-ups never count.
 */
export function exerciseTrend(exercise: Exercise, sessions: Session[]): ExerciseTrend {
  const finished = sessions
    .filter((s) => s.finishedAt !== null && s.deletedAt === undefined)
    .sort((a, b) => a.startedAt - b.startedAt)
  const { kind } = seriesFor(exercise, finished)
  const points: TrendPoint[] = []
  let top = -Infinity

  for (const session of finished) {
    const sets = session.entries.filter((e) => e.exerciseId === exercise.id && countsTowardStats(e))
    let value: number
    let best: SetEntry
    if (kind === 'e1rm') {
      const loaded = sets.filter((s) => s.weightKg !== null)
      if (loaded.length === 0) continue
      best = bestBy(loaded, (s) => epley(s.weightKg as number, s.reps))
      value = epley(best.weightKg as number, best.reps)
    } else if (kind === 'load') {
      if (sets.length === 0) continue
      best = bestBy(sets, (s) => (s.loadKg ?? 0) * 1000 + s.reps)
      value = best.loadKg ?? 0
    } else {
      if (sets.length === 0) continue
      best = bestBy(sets, (s) => s.reps)
      value = sets.reduce((sum, s) => sum + s.reps, 0)
    }
    points.push({ sessionId: session.id, at: session.startedAt, value, best, record: points.length > 0 && value > top })
    top = Math.max(top, value)
  }
  return { kind, points }
}

/** What a trend's number is called, for its caption and its summary. */
export function trendLabel(trend: ExerciseTrend): string {
  if (trend.kind === 'e1rm') return 'Estimated max'
  if (trend.kind === 'reps') return 'Total reps'
  return trend.points.some((p) => p.value < 0) ? 'Assistance' : 'Added load'
}

/** `88.7 kg`, `20 kg assistance` (assistance reads as its size), `34 reps`. */
export function trendValueText(trend: ExerciseTrend, value: number): string {
  if (trend.kind === 'reps') return `${Math.round(value)} reps`
  if (trendLabel(trend) === 'Assistance') return `${Math.round(Math.abs(value) * 10) / 10} kg assistance`
  return `${Math.round(value * 10) / 10} kg`
}

const DAY = 24 * 3600_000

function spanText(ms: number): string {
  const days = Math.round(ms / DAY)
  if (days < 14) return `${days} ${days === 1 ? 'day' : 'days'}`
  const weeks = Math.round(days / 7)
  return `${weeks} weeks`
}

/**
 * One sentence on where the trend went, first point to last: `Estimated max up 6 kg over 8
 * weeks`, `Assistance down 5 kg over 3 weeks` (less assistance is the good way), `Total reps
 * level at 30 reps over 2 weeks`. One point reads `Estimated max 88.7 kg, one session so far`.
 */
export function trendSummary(trend: ExerciseTrend): string {
  const { points } = trend
  const label = trendLabel(trend)
  if (points.length === 0) return `${label}: no sessions yet`
  const last = points[points.length - 1]
  if (points.length === 1) return `${label} ${trendValueText(trend, last.value)}, one session so far`
  const first = points[0]
  const over = spanText(last.at - first.at)
  // Assistance is drawn signed (less is higher), but read as its size: less of it reads `down`.
  const size = (v: number): number => (label === 'Assistance' ? Math.abs(v) : v)
  const delta = size(last.value) - size(first.value)
  const amount = (v: number): string =>
    trend.kind === 'reps' ? `${Math.round(v)} reps` : `${Math.round(Math.abs(v) * 10) / 10} kg`
  if (Math.abs(delta) < 0.05) return `${label} level at ${amount(size(last.value))} over ${over}`
  return `${label} ${delta > 0 ? 'up' : 'down'} ${amount(delta)} over ${over}`
}
