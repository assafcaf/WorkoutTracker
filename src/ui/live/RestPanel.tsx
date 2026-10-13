import type { ReactNode } from 'react'
import { formatRest } from '../../domain/rest'

export type RestPanelProps = {
  /** Seconds of rest still to go; above 0 while the panel shows. */
  remainingSeconds: number
  /** The rest's whole length. */
  totalSeconds: number
  /** How long the trainee usually rests here, or null when there is no telling yet. */
  usualSeconds: number | null
  /** The row over the countdown: "Use 2:40 for Back squat", "Saved to A/B Split". */
  offer?: ReactNode
  /** The countdown itself was tapped: open the rest Dial. */
  onOpenDial(): void
  onLess(): void
  onMore(): void
  onSkip(): void
}

/**
 * The rest panel (Progress Dashboard S4/F2), in the action bar while rest runs: an offer row,
 * the countdown as the hero against "of 3:00", a thin bar of the rest gone with a tick at the
 * trainee's usual rest, and −15 s, +15 s and Skip rest.
 */
export function RestPanel(props: RestPanelProps): JSX.Element {
  const { remainingSeconds, totalSeconds, usualSeconds } = props
  // The axis reaches the usual rest even when this rest is shorter, so the tick always lands.
  const axis = Math.max(totalSeconds, usualSeconds ?? 0, 1)
  const gone = Math.max(0, totalSeconds - remainingSeconds)
  const percent = (seconds: number): string => `${Math.min(100, (seconds / axis) * 100).toFixed(2)}%`

  return (
    <div className="rest-panel">
      {props.offer === undefined || props.offer === null ? null : (
        <div className="rest-panel-offer">{props.offer}</div>
      )}
      <div className="rest-panel-main">
        <div className="rest-panel-clock">
          <button type="button" className="rest-readout cell" onClick={props.onOpenDial}>
            <span role="timer" aria-label="Rest remaining" className="rest-clock">
              {formatRest(remainingSeconds)}
            </span>
          </button>
          <p className="rest-panel-of">
            <span className="rest-panel-caption">Rest</span> of {formatRest(totalSeconds)}
          </p>
        </div>
        <div className="rest-panel-gauge">
          <p className="rest-bar-usual-label" aria-hidden="true">
            {usualSeconds === null ? '' : `you usually rest ${formatRest(usualSeconds)}`}
          </p>
          <div className="rest-bar" aria-hidden="true">
            <span className="rest-bar-fill" style={{ width: percent(gone) }} />
            {usualSeconds === null ? null : (
              <span className="rest-bar-usual" style={{ left: percent(usualSeconds) }} />
            )}
          </div>
          <p className="rest-bar-axis" aria-hidden="true">
            <span>0:00</span>
            <span>{formatRest(axis)}</span>
          </p>
        </div>
      </div>
      <div className="rest-controls">
        <button type="button" className="rest-adjust btn-secondary" onClick={props.onLess}>
          −15 s
        </button>
        <button type="button" className="rest-adjust btn-secondary" onClick={props.onMore}>
          +15 s
        </button>
        <button type="button" className="rest-skip btn-secondary" onClick={props.onSkip}>
          Skip rest
        </button>
      </div>
    </div>
  )
}
