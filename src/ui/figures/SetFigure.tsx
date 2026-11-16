import { loadText } from '../../domain/setText'
import './figures.css'

/**
 * SetFigure -- the one way a weight or a Set is written (Ledger & Instrument, study §3 Numerals).
 *
 *   <SetFigure set={{ weightKg: 70 }} />                        70 kg   (a weight alone: unit in ink-3)
 *   <SetFigure set={{ weightKg: 70, reps: 8 }} />               70 × 8  (the × in ink-3, spaced by CSS)
 *   <SetFigure set={{ weightKg: 46.25, reps: 9 }} moreReps={[8, 8]} />   46.25 × 9 · 8 · 8
 *   <SetFigure set={{ weightKg: null, loadKg: -19, reps: 6 }} />          BW−19 × 6 (true minus)
 *   <SetFigure set={...} stack />                               load over "×reps", for narrow cells
 *
 * Props:
 *   - `set`: `weightKg` (null on a Bodyweight Set), its signed `loadKg` (BW, BW+5, BW−19) and
 *     `reps`; leave `reps` out to write a weight alone.
 *   - `moreReps`: the reps of further Sets at the same load, written `· 8 · 8` after the first.
 *   - `unit`: write `kg` after a numeric load. Default: only for a weight alone.
 *   - `stack`: put the `×reps` part on its own line (the All grid's two-line cell).
 *   - `className`: the site's layout class, added to `set-figure`.
 *
 * The text content stays compact (`70×8`, `70 kg`): the spaces around the `×` are drawn by
 * CSS, so screen readers and text queries read the Set the way the rest of the app writes it.
 * Every number is tabular and lining; nothing here is coloured, since a figure is never the
 * verdict.
 */
export type SetFigureProps = {
  set: { weightKg: number | null; loadKg?: number; reps?: number }
  moreReps?: readonly number[]
  unit?: boolean
  stack?: boolean
  className?: string
}

export function SetFigure({ set, moreReps = [], unit, stack = false, className }: SetFigureProps): JSX.Element {
  const showUnit = (unit ?? set.reps === undefined) && set.weightKg !== null
  const reps = set.reps === undefined ? [] : [set.reps, ...moreReps]
  return (
    <span
      className={className === undefined ? 'set-figure' : `set-figure ${className}`}
      data-stack={stack ? 'true' : undefined}
    >
      <span className="set-figure-load">
        {loadText({ weightKg: set.weightKg, loadKg: set.loadKg })}
        {showUnit ? <span className="set-figure-unit"> kg</span> : null}
      </span>
      {reps.length === 0 ? null : (
        <span className="set-figure-reps">
          <span className="set-figure-times">×</span>
          {reps.join(' · ')}
        </span>
      )}
    </span>
  )
}
