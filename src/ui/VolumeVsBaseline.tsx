import './VolumeVsBaseline.css'
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

/**
 * The text after "Volume vs " naming the chosen baseline (E8-T10, spec O16/O17): `last workout`
 * for `{ period: 'last' }`, `week average` / `best this week` for `1w`, `month average` /
 * `best this month` for `1m`, `3-month average` / `3-month best` for `3m`, `6-month average` /
 * `6-month best` for `6m`, and `average since <d> <Mon>` / `best since <d> <Mon>` for `since`.
 */
export function baselineLabel(_baseline: VolumeBaseline): string {
  throw new Error('NotImplementedError: baselineLabel is not implemented yet')
}

/**
 * Today's volume of `exercise` as a labelled percentage of the chosen baseline (E8-T10, spec
 * O16/O17): replaces the row's unlabelled `ProgressionBar`. With no baseline volume to compare
 * against, shows `No previous workout` (the default `{ period: 'last' }`) or
 * `No workout in this period` (any other), and no `progressbar`.
 */
export function VolumeVsBaseline(_props: VolumeVsBaselineProps): JSX.Element {
  throw new Error('NotImplementedError: VolumeVsBaseline is not implemented yet')
}
