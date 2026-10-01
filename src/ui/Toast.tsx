import { useEffect, useRef } from 'react'

/** How long a toast stays before it dismisses itself. */
const TOAST_MS = 3000

/** A short-lived message that dismisses itself after 3 s (E13-T6). */
export function Toast({ message, onDismiss }: { message: string; onDismiss(): void }): JSX.Element {
  // Read through a ref so a caller's fresh callback each render does not restart the 3 s.
  const dismiss = useRef(onDismiss)
  dismiss.current = onDismiss

  useEffect(() => {
    const timer = setTimeout(() => dismiss.current(), TOAST_MS)
    return () => clearTimeout(timer)
  }, [message])

  return (
    <p role="status" className="toast">
      {message}
    </p>
  )
}
