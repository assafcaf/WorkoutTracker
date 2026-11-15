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
}

/**
 * The rest dock (Progress Dashboard S4/F2, V3-03), in the action bar over Log set while rest
 * runs: one row, as Set Table's rest dock has it -- the countdown as the hero over "of 3:00",
 * then −15 s, +15 s and Skip. The rest Dial's offer, when there is one, takes a row over it.
 */
export function RestPanel(props: RestPanelProps): JSX.Element {
  const { remainingSeconds, totalSeconds } = props

  return (
    <div className="rest-panel">
      {props.offer === undefined || props.offer === null ? null : (
        <div className="rest-panel-offer">{props.offer}</div>
      )}
      <div className="rest-panel-main">
        <div className="rest-panel-time">
          <button type="button" className="rest-readout cell" onClick={props.onOpenDial}>
            <span role="timer" aria-label="Rest remaining" className="rest-clock">
              {formatRest(remainingSeconds)}
            </span>
          </button>
          <p className="rest-panel-of">of {formatRest(totalSeconds)}</p>
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
          <button type="button" className="rest-skip btn-secondary" aria-label="Skip rest" onClick={props.onSkip}>
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
