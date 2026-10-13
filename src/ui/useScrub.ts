import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

/** How far a finger travels, in px, for one step of the value. */
export const SCRUB_NOTCH_PX = 22

/** Movement under this many px is a tap, not a drag. */
const TAP_SLOP_PX = 6

/**
 * Drag a number up or down to change it, one `step` per notch of travel.
 *
 * `step(value, dir)` answers the value one step up (+1) or down (-1); the drag applies it once
 * per notch from the value the drag started at, so a drag back to where it began restores that
 * value. Up is more. A drag that moved past the tap slop swallows the click that follows it, so
 * releasing a drag never opens the keypad the readout opens on a tap (`consumeDrag`).
 */
export function useScrub(
  value: number | null,
  step: (value: number, dir: 1 | -1) => number,
  onChange: (value: number) => void,
) {
  const drag = useRef<{ y: number; start: number; moved: boolean } | null>(null)
  const dragged = useRef(false)
  const [active, setActive] = useState(false)

  function onPointerDown(event: ReactPointerEvent<HTMLElement>): void {
    if (value === null) return
    // Capture keeps the drag going when the finger leaves the number. A browser without it, or
    // a pointer it does not know, still drags while the finger stays on the number.
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId)
    } catch {
      /* drag without capture */
    }
    drag.current = { y: event.clientY, start: value, moved: false }
    dragged.current = false
    setActive(true)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>): void {
    const current = drag.current
    if (current === null) return
    const travel = current.y - event.clientY
    if (Math.abs(travel) > TAP_SLOP_PX) current.moved = true
    if (!current.moved) return
    const notches = Math.trunc(travel / SCRUB_NOTCH_PX)
    let next = current.start
    const dir = notches > 0 ? 1 : -1
    for (let i = 0; i < Math.abs(notches); i++) next = step(next, dir)
    if (next !== value) onChange(next)
  }

  function onPointerEnd(): void {
    const current = drag.current
    drag.current = null
    dragged.current = current?.moved ?? false
    setActive(false)
  }

  /** True once after a drag: the click the drag's release fires is not a tap. */
  function consumeDrag(): boolean {
    const was = dragged.current
    dragged.current = false
    return was
  }

  return {
    active,
    consumeDrag,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
    },
  }
}
