import type { ReactNode } from 'react'
import { formatRest } from '../../domain/rest'

export type RestPanelProps = {
  /** Seconds of rest still to go; above 0 while the panel shows. */
  remainingSeconds: number
  /** The rest's whole length. */
  totalSeconds: number
  /** A row over the dock: the rest Dial's "Use 2:30 for Back squat", "Saved to A/B Split". */
  offer?: ReactNode
  /** The countdown itself was tapped: open the rest Dial. */
  onOpenDial(): void
  onLess(): void
  onMore(): void
  onSkip(): void
  /**
   * v7 (study §1.4): `ring` is Rest as its own screen -- the countdown as the hero inside a ring
   * that empties in the live colour, −15 s and +15 s under it; Skip rest is the screen's bar, so
   * this variant draws no Skip of its own. `row` (the default) is the compact dock row, the
   * countdown beside −15 s, +15 s and Skip, for a rest that runs while the Dials are out (an extra
   * Set, the next Set unfolded, the done state).
   */
  variant?: 'row' | 'ring'
}

/**
 * The rest dock (Progress Dashboard S4/F2, V3-03), or Rest's ring hero (v7): the countdown over
 * "of 3:00", −15 s and +15 s, and -- in the row -- Skip. The rest Dial's offer, when there is one,
 * takes a row of its own.
 */
export function RestPanel(props: RestPanelProps): JSX.Element {
  const { remainingSeconds, totalSeconds } = props
  const readout = (
    <button type="button" className="rest-readout cell" onClick={props.onOpenDial}>
      <span role="timer" aria-label="Rest remaining" className="rest-clock">
        {formatRest(remainingSeconds)}
      </span>
    </button>
  )
  const less = (
    <button
      type="button"
      className="rest-adjust btn-secondary"
      aria-label="Rest 15 seconds less"
      onClick={props.onLess}
    >
      −15 s
    </button>
  )
  const more = (
    <button
      type="button"
      className="rest-adjust btn-secondary"
      aria-label="Rest 15 seconds more"
      onClick={props.onMore}
    >
      +15 s
    </button>
  )
  const offer =
    props.offer === undefined || props.offer === null ? null : <div className="rest-panel-offer">{props.offer}</div>

  if (props.variant === 'ring') {
    // The arc is the rest still to go, drawn clockwise from the top; it empties as rest runs.
    const left = totalSeconds <= 0 ? 0 : Math.min(1, Math.max(0, remainingSeconds / totalSeconds))
    return (
      <div className="rest-panel rest-panel--ring">
        <div className="rest-ring">
          {/* The ring itself is CSS (a conic gradient), so no inline SVG lives outside the icon set. */}
          <span
            className="rest-ring-arc"
            aria-hidden="true"
            style={{
              background: `conic-gradient(var(--color-live) ${(left * 100).toFixed(2)}%, var(--color-hairline) 0)`,
            }}
          />
          <div className="rest-ring-centre">
            {readout}
            <p className="rest-panel-of">of {formatRest(totalSeconds)}</p>
          </div>
        </div>
        <div className="rest-controls rest-ring-controls">
          {less}
          {more}
        </div>
        {offer}
      </div>
    )
  }

  return (
    <div className="rest-panel">
      {offer}
      <div className="rest-panel-main">
        <div className="rest-panel-time">
          {readout}
          <p className="rest-panel-of">of {formatRest(totalSeconds)}</p>
        </div>
        <div className="rest-controls">
          {less}
          {more}
          <button type="button" className="rest-skip btn-secondary" aria-label="Skip rest" onClick={props.onSkip}>
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
