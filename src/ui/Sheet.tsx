import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './Sheet.css'

export type SheetProps = {
  /** The sheet's name for a screen reader: "Back squat tools", "Edit set 2 · Back squat". */
  label: string
  /** Told on Escape and on a tap of the scrim. */
  onClose(): void
  children: ReactNode
}

/**
 * A bottom sheet (Progress Dashboard S3b, S2b): a scrim over the screen, and a panel with a
 * rounded top and a grabber rising from the bottom edge. Rendered into `document.body`, so it
 * sits over the shell's action bar too. A short task lives here; a long one gets a full screen.
 *
 * The screen it covers marks itself `aria-hidden`/`inert` while the sheet is open, so the sheet
 * is the only thing a screen reader or the keyboard reaches.
 */
export function Sheet({ label, onClose, children }: SheetProps): JSX.Element {
  const close = useRef(onClose)
  close.current = onClose
  const panel = useRef<HTMLElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close.current()
    }
    document.addEventListener('keydown', onKey)
    panel.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return createPortal(
    <div className="sheet-layer">
      <div className="sheet-scrim" aria-hidden="true" onClick={() => close.current()} />
      <section
        ref={panel}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
      >
        <div className="sheet-grabber" aria-hidden="true" />
        {children}
      </section>
    </div>,
    document.body,
  )
}
