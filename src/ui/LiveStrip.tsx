import { useEffect, useState } from 'react'
import { formatRest } from '../domain/rest'
import { ElapsedTime } from './ElapsedTime'
import './LiveStrip.css'

/** What the live strip says about a minimised workout. */
export type LiveStatus = {
  workoutName: string
  startedAt: number
  /** When the rest after the Session's latest Set runs out, or null with no Set logged. */
  restEndsAt: number | null
  /** The set to log next, e.g. "Back squat · set 3", or null once every planned set is in. */
  next: string | null
}

export type LiveStripProps = {
  status: LiveStatus
  /** Brings the full-screen Live session back. */
  onReturn(): void
}

/**
 * The 48 px live strip pinned to the top of every tab while a workout is minimised
 * (t_strip.png): the workout's name, its elapsed time, then the rest countdown while one runs or
 * the set due next, and Return. A tap anywhere on it returns to the session; the Return button
 * is the same way back for the keyboard and a screen reader.
 */
export function LiveStrip({ status, onReturn }: LiveStripProps): JSX.Element {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const restLeft = status.restEndsAt === null ? 0 : (status.restEndsAt - now) / 1000
  const detail = restLeft > 0 ? `Rest ${formatRest(restLeft)}` : status.next

  return (
    // The whole strip is the tap target on a phone; the button inside it is the accessible one.
    <div className="live-strip" onClick={onReturn}>
      <span className="live-strip-dot" aria-hidden="true" />
      <span className="live-strip-text">
        {status.workoutName} · <ElapsedTime startedAt={status.startedAt} />
        {detail ? <span className="live-strip-detail"> · {detail}</span> : null}
      </span>
      <button
        type="button"
        className="live-strip-return btn-quiet"
        aria-label={`Return to ${status.workoutName}`}
        onClick={(event) => {
          event.stopPropagation()
          onReturn()
        }}
      >
        Return
      </button>
    </div>
  )
}
