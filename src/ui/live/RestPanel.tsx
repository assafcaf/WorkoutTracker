import type { ReactNode } from 'react'
import { formatRest } from '../../domain/rest'

export type RestPanelProps = {
  /** Seconds of rest still to go; above 0 while the panel shows. */
  remainingSeconds: number
  /** The rest's whole length. */
  totalSeconds: number
  /** The row over the countdown: "Use 2:40 for Back squat", "Saved to A/B Split". */
  offer?: ReactNode
  /** The countdown itself was tapped: open the rest Dial. */
  onOpenDial(): void
  onLess(): void
  onMore(): void
  onSkip(): void
}

/**
 * The rest panel (Progress Dashboard S4/F2), in the action bar over Log set while rest runs: the
 * countdown as the hero beside "REST of 3:00" and the offer at that row's end (V2-02), then
 * −15 s, +15 s and Skip rest. Two time values and the offer, nothing more (V1-11).
 */
export function RestPanel(props: RestPanelProps): JSX.Element {
  const { remainingSeconds, totalSeconds } = props

  return (
    <div className="rest-panel">
      <div className="rest-panel-main">
        <button type="button" className="rest-readout cell" onClick={props.onOpenDial}>
          <span role="timer" aria-label="Rest remaining" className="rest-clock">
            {formatRest(remainingSeconds)}
          </span>
        </button>
        <p className="rest-panel-of">
          <span className="rest-panel-caption">Rest</span>
          <span>of {formatRest(totalSeconds)}</span>
        </p>
        {/* The offer joins the countdown's row (V2-02) rather than taking a row of its own. */}
        {props.offer === undefined || props.offer === null ? null : (
          <div className="rest-panel-offer">{props.offer}</div>
        )}
      </div>
      <div className="rest-controls">
        <button
          type="button"
          className="rest-adjust btn-secondary"
          aria-label="Rest 15 seconds less"
          onClick={props.onLess}
        >
          −15 s
        </button>
        <button
          type="button"
          className="rest-adjust btn-secondary"
          aria-label="Rest 15 seconds more"
          onClick={props.onMore}
        >
          +15 s
        </button>
        <button type="button" className="rest-skip btn-secondary" onClick={props.onSkip}>
          Skip rest
        </button>
      </div>
    </div>
  )
}
