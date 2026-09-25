import { useState } from 'react'
import { Keypad } from './Keypad'
import { useCentredRung } from './useCentredRung'
import './dial.css'

export type RepsDialProps = {
  value: number
  onChange(value: number): void
}

/** The rungs the reps column snaps through; anything between them arrives by keypad. */
const REPS_COLUMN = Array.from({ length: 30 }, (_, index) => index + 1)

/**
 * The reps scroll-snap column with its minus/plus buttons and its readout.
 *
 * Whole reps by column and by minus/plus; a fraction like 9.5 comes in through the keypad the
 * readout opens.
 */
export function RepsDial(props: RepsDialProps): JSX.Element {
  const { value, onChange } = props
  const [keypadOpen, setKeypadOpen] = useState(false)
  const columnRef = useCentredRung(value)

  function step(dir: 1 | -1): void {
    onChange(Math.max(0, value + dir))
  }

  return (
    <div className="dial" role="group" aria-label="Reps">
      <h3 className="dial-heading">Reps</h3>
      <button
        type="button"
        aria-label="Decrease reps"
        className="dial-step"
        onClick={() => step(-1)}
      >
        &minus;
      </button>
      <div className="dial-body">
        <button
          type="button"
          aria-label="Reps"
          className="dial-readout"
          onClick={() => setKeypadOpen(true)}
        >
          {value}
        </button>
        <span className="dial-unit">reps</span>
        <button
          type="button"
          aria-label="Type reps"
          className="dial-type"
          onClick={() => setKeypadOpen(true)}
        >
          Type reps
        </button>
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
        className="dial-step"
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
