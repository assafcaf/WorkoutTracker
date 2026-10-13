import { useState } from 'react'
import { Keypad } from './Keypad'
import { useCentredRung } from './useCentredRung'
import { useScrub } from './useScrub'
import type { DialVariant } from './dialVariant'
import './dial.css'

export type RepsDialProps = {
  value: number
  onChange(value: number): void
  /** `column` (the default) or the Set screen's `scrub`; see `WeightDialProps.variant`. */
  variant?: DialVariant
}

/** The rungs the reps column snaps through; anything between them arrives by keypad. */
const REPS_COLUMN = Array.from({ length: 30 }, (_, index) => index + 1)

/** One rep up or down, never below 0. */
function stepReps(from: number, dir: 1 | -1): number {
  return Math.max(0, from + dir)
}

/**
 * The reps Dial: its readout, its scroll-snap column and its minus/plus buttons.
 *
 * Whole reps by column, by minus/plus and, in the `scrub` variant, by dragging the number; a
 * fraction like 9.5 comes in through the keypad a tap on the readout opens.
 */
export function RepsDial(props: RepsDialProps): JSX.Element {
  const { value, onChange } = props
  const scrub = props.variant === 'scrub'
  const [keypadOpen, setKeypadOpen] = useState(false)
  const columnRef = useCentredRung(value)
  const drag = useScrub(value, stepReps, onChange)

  function step(dir: 1 | -1): void {
    onChange(stepReps(value, dir))
  }

  const below = stepReps(value, -1)

  return (
    <div
      className={scrub ? 'dial dial--scrub' : 'dial'}
      data-scrubbing={drag.active ? 'true' : undefined}
      role="group"
      aria-label="Reps"
    >
      <h3 className="dial-heading">Reps</h3>
      <button
        type="button"
        aria-label="Decrease reps"
        className="dial-step icon-btn"
        onClick={() => step(-1)}
      >
        &minus;
      </button>
      <div className="dial-body" {...(scrub ? drag.handlers : {})}>
        {scrub ? (
          <span className="dial-ghost" aria-hidden="true">
            {stepReps(value, 1)}
          </span>
        ) : null}
        <button
          type="button"
          aria-label="Reps"
          className="dial-readout cell"
          onClick={() => {
            if (drag.consumeDrag()) return
            setKeypadOpen(true)
          }}
        >
          {value}
        </button>
        {scrub ? (
          <span className="dial-ghost" aria-hidden="true">
            {below === value ? '' : below}
          </span>
        ) : null}
        <span className="dial-unit">reps</span>
        <ul role="listbox" aria-label="Reps ladder" className="dial-column" ref={columnRef}>
          {REPS_COLUMN.map((rung) => (
            <li
              key={rung}
              role="option"
              aria-selected={rung === value}
              className="dial-rung"
              onClick={() => onChange(rung)}
            >
              {rung}
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        aria-label="Increase reps"
        className="dial-step icon-btn"
        onClick={() => step(1)}
      >
        +
      </button>
      {keypadOpen ? (
        <Keypad
          label="Reps"
          value={value}
          onCommit={(entered) => {
            onChange(entered)
            setKeypadOpen(false)
          }}
          onCancel={() => setKeypadOpen(false)}
        />
      ) : null}
    </div>
  )
}
