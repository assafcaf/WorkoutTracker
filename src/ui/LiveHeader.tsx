import { useContext } from 'react'
import type { ReactNode } from 'react'
import { ShellChromeContext } from './AppShell'
import { ElapsedTime } from './ElapsedTime'
import { Icon } from './icons'
import './LiveHeader.css'

export type LiveHeaderProps = {
  workoutName: string
  startedAt: number
  /** Folds the Live session away to the live strip over the tabs. */
  onMinimise(): void
  onFinish(): void
  /**
   * Whether the workout's name is the screen's `<h1>` (default `true`). The set screen passes
   * `false`: there the exercise it is on is the screen's heading.
   */
  heading?: boolean
  /** What sits under the header row, e.g. the Now | All switch. */
  children?: ReactNode
}

/**
 * The Live session's header (S2/S3): a chevron that minimises the session, the workout's name
 * with its elapsed time, and Finish. The app root's trailing slot (the "Update ready" pill)
 * rides along, so an update never has to wait for the workout to end to be offered.
 */
export function LiveHeader(props: LiveHeaderProps): JSX.Element {
  const { workoutName, startedAt, onMinimise, onFinish, heading = true, children } = props
  const { trailing } = useContext(ShellChromeContext)

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
          <ElapsedTime startedAt={startedAt} />
        </div>
        {trailing ? <div className="app-header-trailing live-header-trailing">{trailing}</div> : null}
        <button type="button" className="finish-workout btn-secondary" onClick={onFinish}>
          Finish
        </button>
      </div>
      {children}
    </header>
  )
}
