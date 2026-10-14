import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './Toast.css'

/** How long a toast stays before it dismisses itself. */
const TOAST_MS = 3000

export type ToastProps = {
  /** The headline: "New PR · Heaviest set". */
  message: string
  /** The line under it: "62.5 kg × 8 · +2.5 kg". */
  detail?: string
  /** A tag before the text, e.g. the PR tag. */
  lead?: ReactNode
  /** A word-sized chart after the text, e.g. the record's sparkline. */
  trail?: ReactNode
  onDismiss(): void
}

/**
 * A short-lived card pinned to the top of the screen that dismisses itself after 3 s (E13-T6,
 * Progress Dashboard S5a). Nothing blocks: it is a status, never a dialog.
 */
export function Toast({ message, detail, lead, trail, onDismiss }: ToastProps): JSX.Element {
  // Read through a ref so a caller's fresh callback each render does not restart the 3 s.
  const dismiss = useRef(onDismiss)
  dismiss.current = onDismiss

  useEffect(() => {
    const timer = setTimeout(() => dismiss.current(), TOAST_MS)
    return () => clearTimeout(timer)
  }, [message, detail])

  return createPortal(
    <div role="status" className="toast">
      {lead}
      <div className="toast-text">
        <p className="toast-message">{message}</p>
        {detail === undefined ? null : <p className="toast-detail">{detail}</p>}
      </div>
      {trail}
    </div>,
    document.body,
  )
}
