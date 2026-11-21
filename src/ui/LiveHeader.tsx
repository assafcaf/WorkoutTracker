import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ShellChromeContext } from './AppShell'
import { Icon } from './icons'
import { Sheet } from './Sheet'
import './LiveHeader.css'

export type LiveHeaderProps = {
  workoutName: string
  startedAt: number
  /** Folds the Live session away to the live strip over the tabs. */
  onMinimise(): void
  onFinish(): void
  /**
   * No longer offered here (DX-14): Discard lives once, at the bottom of the All view, with Undo.
   * Kept so callers still type-check.
   */
  onDiscard?(): void
  /**
   * Today's working Sets against the Workout's planned Sets: line 2 reads "1 of 23 sets · 4 min"
   * and the 2 px bar under the header fills to their fraction (DX-19). Left out, neither shows.
   */
  sets?: { done: number; planned: number }
  /**
   * The Session's Records so far. No longer shown (v7, study §1.5: no PR count in the live header;
   * the PR is on its Set's cell); kept so callers still type-check.
   */
  prs?: number
  /**
   * Planned Sets not yet logged (default 0). With none left, Finish ends the Session in one tap;
   * with some left it asks once, "Finish with 22 sets not logged?" (DX-14).
   */
  setsLeft?: number
  /**
   * Whether the workout's name is the screen's `<h1>` (default `true`). The set screen passes
   * `false`: there the exercise it is on is the screen's heading.
   */
  heading?: boolean
  /** What sits in the header row before Finish: the Set | All control (DX-19). */
  children?: ReactNode
}

/** Whole minutes since `startedAt`, re-read every 15 s: "4 min" (DX-19). */
function useElapsedMinutes(startedAt: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [startedAt])
  return Math.max(0, Math.floor((now - startedAt) / 60_000))
}

/**
 * The Live session's header (S2/S3, DX-19): a chevron that minimises the session, the workout's
 * name over "1 of 23 sets · 4 min" at body size in ink, the Set | All control, and Finish; a 2 px
 * bar under the whole header fills as Sets are logged. The app root's trailing slot (the "Update
 * ready" pill) rides along, so an update never has to wait for the workout to end to be offered.
 */
export function LiveHeader(props: LiveHeaderProps): JSX.Element {
  const { workoutName, startedAt, onMinimise, onFinish, sets, setsLeft = 0, heading = true, children } = props
  const { trailing } = useContext(ShellChromeContext)
  const [confirming, setConfirming] = useState(false)
  const minutes = useElapsedMinutes(startedAt)
  // V5-15: at large text the line cannot hold the Sets count and the minutes; the minutes go and
  // the count stays. Measured once it renders; once dropped it stays dropped.
  const metaRef = useRef<HTMLParagraphElement>(null)
  const [timeDropped, setTimeDropped] = useState(false)
  useLayoutEffect(() => {
    const meta = metaRef.current
    if (timeDropped || meta === null || sets === undefined) return
    if (meta.scrollWidth > meta.clientWidth) setTimeDropped(true)
  }, [timeDropped, sets])

  // DX-14: a fully logged Session finishes in one tap; otherwise one plain question.
  function handleFinish(): void {
    if (setsLeft > 0) setConfirming(true)
    else onFinish()
  }

  const fraction = sets === undefined || sets.planned <= 0 ? 0 : Math.min(1, sets.done / sets.planned)

  return (
    <header className="app-header live-header">
      <div className="live-header-row">
        <button type="button" className="live-header-minimise icon-btn" aria-label="Minimise" onClick={onMinimise}>
          <Icon name="ChevronDown" size={24} />
        </button>
        <div className="live-header-title">
          {heading ? (
            <h1 className="live-header-name">{workoutName}</h1>
          ) : (
            <span className="live-header-name">{workoutName}</span>
          )}
          <p className="live-header-meta" ref={metaRef}>
            {sets === undefined ? null : (
              <span className="live-header-sets">{`${sets.done} of ${sets.planned} sets`}</span>
            )}
            {timeDropped ? null : (
              <>
                {sets === undefined ? null : <span aria-hidden="true">{' · '}</span>}
                <span role="timer" aria-label="Workout time" className="live-header-time">{`${minutes} min`}</span>
              </>
            )}
          </p>
        </div>
        {trailing ? <div className="app-header-trailing live-header-trailing">{trailing}</div> : null}
        {/* The Set | All control rides in the row, before Finish (DX-19): no band under it. */}
        {children}
        <button type="button" className="finish-workout btn-secondary" onClick={handleFinish}>
          Finish
        </button>
      </div>
      {sets === undefined ? null : (
        <div
          className="live-header-progress"
          role="progressbar"
          aria-label="Sets logged"
          aria-valuemin={0}
          aria-valuemax={sets.planned}
          aria-valuenow={sets.done}
        >
          <span className="live-header-progress-fill" style={{ width: `${(fraction * 100).toFixed(2)}%` }} />
        </div>
      )}
      {confirming ? (
        <Sheet label="Finish Session?" onClose={() => setConfirming(false)}>
          <div className="sheet-head">
            <h2 className="sheet-title">
              {`Finish with ${setsLeft} ${setsLeft === 1 ? 'set' : 'sets'} not logged?`}
            </h2>
            <button
              type="button"
              className="sheet-close icon-btn"
              aria-label="Close"
              onClick={() => setConfirming(false)}
            >
              <Icon name="X" size={24} />
            </button>
          </div>
          <div className="finish-confirm-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setConfirming(false)
                onFinish()
              }}
            >
              Finish Session
            </button>
            <button type="button" className="btn-secondary" onClick={() => setConfirming(false)}>
              Keep going
            </button>
          </div>
        </Sheet>
      ) : null}
    </header>
  )
}
