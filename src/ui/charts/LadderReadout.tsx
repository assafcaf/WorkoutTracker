import './LadderReadout.css'
import type { LadderReadoutRows } from './ladderView'

export type LadderReadoutProps = {
  rows: LadderReadoutRows
  onOpenSession?: (sessionId: string) => void
}

/**
 * The scrub readout (E18-T8, O19), docked above the tab bar and kept after release: the Session's
 * title, its working sets, its record, its estimated 1RM (labelled, when the lift has one), its
 * note and its warm-ups, which read `not counted`.
 */
export function LadderReadout({ rows, onOpenSession }: LadderReadoutProps): JSX.Element {
  return (
    <section className="ladder-readout" aria-label="Session readout">
      <div className="ladder-readout-head">
        <h3 className="ladder-readout-title">{rows.title}</h3>
        {onOpenSession ? (
          <button type="button" className="btn-quiet ladder-readout-open" onClick={() => onOpenSession(rows.sessionId)}>
            Open session ›
          </button>
        ) : null}
      </div>
      <p className="ladder-readout-sets">{rows.workingSets.join(' · ')}</p>
      {rows.record ? <p className="ladder-readout-line">{`Record: ${rows.record}`}</p> : null}
      {rows.e1rm ? <p className="ladder-readout-line">{`e1RM ${rows.e1rm} (estimated)`}</p> : null}
      {rows.note ? <p className="ladder-readout-line">{rows.note}</p> : null}
      {rows.warmups ? (
        <p className="ladder-readout-line ladder-readout-muted">{`Warm-ups ${rows.warmups} · not counted`}</p>
      ) : null}
    </section>
  )
}
