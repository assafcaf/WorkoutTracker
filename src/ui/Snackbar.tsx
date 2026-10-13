import { createPortal } from 'react-dom'
import './Snackbar.css'

export type SnackbarProps = {
  /** "Set deleted". */
  message: string
  /** The one action, e.g. Undo. */
  actionLabel: string
  onAction(): void
}

/**
 * The dark snackbar over the bottom of the screen (Progress Dashboard S2b): what just happened
 * and the one way to take it back, "Set deleted · Undo". Undo, not a confirm: nothing asks
 * first. The caller owns how long it stays.
 */
export function Snackbar({ message, actionLabel, onAction }: SnackbarProps): JSX.Element {
  return createPortal(
    <div role="status" className="snackbar">
      <span className="snackbar-message">{message} ·</span>
      <button type="button" className="snackbar-action btn-quiet" onClick={onAction}>
        {actionLabel}
      </button>
    </div>,
    document.body,
  )
}
