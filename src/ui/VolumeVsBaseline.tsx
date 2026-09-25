import './VolumeVsBaseline.css'
import { baselineVolume, exerciseVolume, volumePercent } from '../domain/exerciseVolume'
import type { Exercise, Session, SetEntry, VolumeBaseline } from '../types'

export type VolumeVsBaselineProps = {
  exercise: Exercise
  /** Today's session entries; only this exercise's own count toward its volume. */
  entries: SetEntry[]
  /** Every finished Session, from which the baseline is resolved. */
  sessions: Session[]
  baseline: VolumeBaseline
  now: number
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/**
 * The text after "Volume vs " naming the chosen baseline (E8-T10, spec O16/O17): `last workout`
 * for `{ period: 'last' }`, `week average` / `best this week` for `1w`, `month average` /
 * `best this month` for `1m`, `3-month average` / `3-month best` for `3m`, `6-month average` /
 * `6-month best` for `6m`, and `average since <d> <Mon>` / `best since <d> <Mon>` for `since`.
 */
export function baselineLabel(baseline: VolumeBaseline): string {
  switch (baseline.period) {
    case 'last':
      return 'last workout'
    case '1w':
      return baseline.aggregate === 'max' ? 'best this week' : 'week average'
    case '1m':
      return baseline.aggregate === 'max' ? 'best this month' : 'month average'
    case '3m':
      return baseline.aggregate === 'max' ? '3-month best' : '3-month average'
    case '6m':
      return baseline.aggregate === 'max' ? '6-month best' : '6-month average'
    case 'since': {
      const date = new Date(baseline.since)
      const named = `${date.getUTCDate()} ${MONTH_NAMES[date.getUTCMonth()]}`
      return baseline.aggregate === 'max' ? `best since ${named}` : `average since ${named}`
    }
  }
}

/**
 * Today's volume of `exercise` as a labelled percentage of the chosen baseline (E8-T10, spec
 * O16/O17): replaces the row's unlabelled `ProgressionBar`. With no baseline volume to compare
 * against, shows `No previous workout` (the default `{ period: 'last' }`) or
 * `No workout in this period` (any other), and no `progressbar`.
 */
export function VolumeVsBaseline({ exercise, entries, sessions, baseline, now }: VolumeVsBaselineProps): JSX.Element {
  const today = exerciseVolume(exercise, entries).amount
  const base = baselineVolume(exercise, sessions, baseline, now)
  const percent = volumePercent(today, base)

  if (percent === null) {
    const message = baseline.period === 'last' ? 'No previous workout' : 'No workout in this period'
    return <div className="volume-vs-baseline">{message}</div>
  }

  const clamped = Math.min(percent, 100)

  return (
    <div className="volume-vs-baseline">
      <div
        className="volume-vs-baseline-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
      >
        <div className="volume-vs-baseline-fill" style={{ width: `${clamped}%` }} />
      </div>
      <span className="volume-vs-baseline-label">{`Volume vs ${baselineLabel(baseline)}: ${percent}%`}</span>
    </div>
  )
}
