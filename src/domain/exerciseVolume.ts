import type { Exercise, Session, SetEntry, VolumeBaseline } from '../types'

export type ExerciseVolume = { amount: number; unit: 'kg' | 'reps' }

/**
 * An Exercise's volume over a set of entries (O1): `Σ reps × weightKg` for a loaded Exercise, or
 * `Σ reps` for a Bodyweight or `invertProgress` one -- the same split as `volumeSeries`. Sums
 * only entries whose `exerciseId` matches `exercise.id`.
 */
export function exerciseVolume(exercise: Exercise, entries: SetEntry[]): ExerciseVolume {
  const own = entries.filter((entry) => entry.exerciseId === exercise.id)

  if (!exercise.bodyweight && !exercise.invertProgress) {
    const amount = own.reduce((sum, entry) => sum + entry.reps * (entry.weightKg ?? 0), 0)
    return { amount, unit: 'kg' }
  }

  const amount = own.reduce((sum, entry) => sum + entry.reps, 0)
  return { amount, unit: 'reps' }
}

/** Today's volume as a percentage of `baseline` (O1); `null` when there is nothing to compare. */
export function volumePercent(today: number, baseline: number | null): number | null {
  if (baseline === null || baseline === 0) return null
  return Math.round((100 * today) / baseline)
}

const PERIOD_DAYS: Record<'1w' | '1m' | '3m' | '6m', number> = {
  '1w': 7,
  '1m': 30,
  '3m': 91,
  '6m': 182,
}
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The volume an Exercise's `VolumeBaseline` setting resolves to as of `now` (O2): the last
 * finished Session holding the Exercise, or an average/max of per-Session volume over a period.
 * Only Sessions with `finishedAt !== null` that hold the Exercise count; `null` when none do.
 */
export function baselineVolume(
  exercise: Exercise,
  sessions: Session[],
  baseline: VolumeBaseline,
  now: number,
): number | null {
  const finished = sessions.filter(
    (session) => session.finishedAt !== null && session.entries.some((entry) => entry.exerciseId === exercise.id),
  )

  if (finished.length === 0) return null

  if (baseline.period === 'last') {
    const last = [...finished].sort((a, b) => b.startedAt - a.startedAt)[0]
    return exerciseVolume(exercise, last.entries).amount
  }

  const since = baseline.period === 'since' ? baseline.since : now - PERIOD_DAYS[baseline.period] * DAY_MS

  const inWindow = finished.filter((session) => session.startedAt >= since)
  if (inWindow.length === 0) return null

  const amounts = inWindow.map((session) => exerciseVolume(exercise, session.entries).amount)

  if (baseline.aggregate === 'max') {
    return Math.max(...amounts)
  }

  return amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length
}
