import { createPortal } from 'react-dom'
import './Snackbar.css'

export type SnackbarProps = {
  /** What just happened, naming the thing: "Set 1 deleted · 60 × 10". */
  message: string
  /** The one action, e.g. Undo; omitted, the bar only says what happened (V6). */
  actionLabel?: string
  onAction?(): void
  /**
   * V6 (V5-04): drawn where it is written, not over the bottom of the screen. The Set screen
   * places it in an anchor above its Dials, so it never covers the reps Dial or the rest timer.
   */
  inline?: boolean
}

/**
 * The dark snackbar over the bottom of the screen (Progress Dashboard S2b): what just happened
 * and the one way to take it back, "Set deleted · Undo". Undo, not a confirm: nothing asks
 * first. The caller owns how long it stays. The message and its action are apart by layout
 * alone: no separator trails the message (V5-04).
 */
export function Snackbar({ message, actionLabel, onAction, inline = false }: SnackbarProps): JSX.Element {
  const bar = (
    <div role="status" className={inline ? 'snackbar snackbar--inline' : 'snackbar'}>
      <span className="snackbar-message">{message}</span>
      {actionLabel === undefined ? null : (
        <button type="button" className="snackbar-action btn-quiet" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  )
  return inline ? bar : createPortal(bar, document.body)
}
