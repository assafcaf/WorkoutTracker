import { useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { ShellChromeContext } from './AppShell'
import { ElapsedTime } from './ElapsedTime'
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
   * Throws the Session away (iteration 5): offered in the Finish sheet, and the only way out of it
   * while nothing is logged, so a workout started by mistake is one tap from gone.
   */
  onDiscard?(): void
  /**
   * Today's working Sets against the Workout's planned Sets, shown as "2/23 sets" in the title
   * row. Left out, no count is shown.
   */
  sets?: { done: number; planned: number }
  /** The Session's Records so far (V2-11): "· 1 PR" after the Sets count once there is one. */
  prs?: number
  /**
   * Planned Sets not yet logged (default 0). While any are left, Finish asks first in a Sheet;
   * with none left, Finish ends the Session in one tap.
   */
  setsLeft?: number
  /**
   * Whether the workout's name is the screen's `<h1>` (default `true`). The set screen passes
   * `false`: there the exercise it is on is the screen's heading.
   */
  heading?: boolean
  /** What sits in the header row before Finish: the Now | All button (V3-07). */
  children?: ReactNode
}

/**
 * The Live session's header (S2/S3): a chevron that minimises the session, the workout's name
 * over its elapsed time and Sets count, and Finish. The app root's trailing slot (the "Update
 * ready" pill) rides along, so an update never has to wait for the workout to end to be offered.
 */
export function LiveHeader(props: LiveHeaderProps): JSX.Element {
  const { workoutName, startedAt, onMinimise, onFinish, onDiscard, sets, prs = 0, setsLeft = 0, heading = true, children } = props
  const { trailing } = useContext(ShellChromeContext)
  const [confirming, setConfirming] = useState(false)
  const nothingLogged = sets !== undefined && sets.done === 0
  // V5-01: with Sets logged, Discard asks once more, naming what is lost; with none, it is one tap.
  const [discarding, setDiscarding] = useState(false)
  const logged = sets?.done ?? 0

  function handleFinish(): void {
    if (setsLeft > 0 || (nothingLogged && onDiscard !== undefined)) setConfirming(true)
    else onFinish()
  }

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
          <p className="live-header-meta">
            <ElapsedTime startedAt={startedAt} />
            {sets === undefined ? null : (
              <>
                <span aria-hidden="true">{' · '}</span>
                <span className="live-header-sets">{`${sets.done}/${sets.planned} sets`}</span>
              </>
            )}
            {prs > 0 ? (
              <>
                <span aria-hidden="true">{' · '}</span>
                <span className="live-header-prs">{`${prs} PR`}</span>
              </>
            ) : null}
          </p>
        </div>
        {trailing ? <div className="app-header-trailing live-header-trailing">{trailing}</div> : null}
        {/* The Now | All switch rides in the row, before Finish (V3-07): no band under it. */}
        {children}
        <button type="button" className="finish-workout btn-secondary" onClick={handleFinish}>
          Finish
        </button>
      </div>
      {confirming ? (
        <Sheet
          label="Finish workout?"
          onClose={() => {
            setConfirming(false)
            setDiscarding(false)
          }}
        >
          <div className="sheet-head">
            <h2 className="sheet-title">Finish workout?</h2>
          </div>
          <p className="finish-confirm-left">
            {nothingLogged ? 'Nothing logged yet' : `${setsLeft} ${setsLeft === 1 ? 'set' : 'sets'} not logged`}
          </p>
          <div className="finish-confirm-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setConfirming(false)
                onFinish()
              }}
            >
              Finish workout
            </button>
            <button type="button" className="btn-secondary" onClick={() => setConfirming(false)}>
              Keep going
            </button>
            {onDiscard === undefined ? null : (
              <button
                type="button"
                className="btn-danger"
                onClick={() => {
                  if (logged > 0 && !discarding) {
                    setDiscarding(true)
                    return
                  }
                  setConfirming(false)
                  setDiscarding(false)
                  onDiscard()
                }}
              >
                {discarding ? `Discard ${logged} logged ${logged === 1 ? 'set' : 'sets'}` : 'Discard workout'}
              </button>
            )}
          </div>
        </Sheet>
      ) : null}
    </header>
  )
}
