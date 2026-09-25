import type { Exercise, Session, SetEntry, VolumeBaseline } from '../types'

export type ExerciseVolume = { amount: number; unit: 'kg' | 'reps' }

/**
 * An Exercise's volume over a set of entries (O1): `Σ reps × weightKg` for a loaded Exercise, or
 * `Σ reps` for a Bodyweight or `invertProgress` one -- the same split as `volumeSeries`. Sums
 * only entries whose `exerciseId` matches `exercise.id`.
 */
export function exerciseVolume(_exercise: Exercise, _entries: SetEntry[]): ExerciseVolume {
  throw new Error('not implemented')
}

/** Today's volume as a percentage of `baseline` (O1); `null` when there is nothing to compare. */
export function volumePercent(_today: number, _baseline: number | null): number | null {
  throw new Error('not implemented')
}

/**
 * The volume an Exercise's `VolumeBaseline` setting resolves to as of `now` (O2): the last
 * finished Session holding the Exercise, or an average/max of per-Session volume over a period.
 * Only Sessions with `finishedAt !== null` that hold the Exercise count; `null` when none do.
 */
export function baselineVolume(
  _exercise: Exercise,
  _sessions: Session[],
  _baseline: VolumeBaseline,
  _now: number,
): number | null {
  throw new Error('not implemented')
}
