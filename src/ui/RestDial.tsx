import { useState } from 'react'
import { formatRest } from '../domain/rest'
import { useCentredRung } from './useCentredRung'
import './dial.css'

export type RestDialProps = {
  /** The rest length now, in seconds; the Dial opens on the Rung nearest it. */
  seconds: number
  onSet(seconds: number): void
  onCancel(): void
}

/** The rest Rungs: 15 s apart, from 0:15 to 10:00 (E13-T9). */
const REST_STEP = 15
const REST_COLUMN = Array.from({ length: 40 }, (_, index) => (index + 1) * REST_STEP)

/** The Rung nearest `seconds`, kept on the ladder. */
function nearestRung(seconds: number): number {
  const rung = Math.round(seconds / REST_STEP) * REST_STEP
  return Math.min(REST_COLUMN[REST_COLUMN.length - 1], Math.max(REST_COLUMN[0], rung))
}

/**
 * The rest Dial, opened from the rest readout: a scroll-snap column of 15 s Rungs with
 * **Set rest** and **Cancel**. Nothing changes until Set rest.
 */
export function RestDial(props: RestDialProps): JSX.Element {
  const { onSet, onCancel } = props
  const [value, setValue] = useState<number>(() => nearestRung(props.seconds))
  const columnRef = useCentredRung(value)

  return (
    <div className="dial rest-dial" role="group" aria-label="Rest">
      <h3 className="dial-heading">Rest</h3>
      <div className="dial-body rest-dial-body">
        <span className="dial-readout">{formatRest(value)}</span>
        <ul role="listbox" aria-label="Rest ladder" className="dial-column" ref={columnRef}>
          {REST_COLUMN.map((rung) => (
            <li
              key={rung}
              role="option"
              aria-selected={rung === value}
              className="dial-rung"
              onClick={() => setValue(rung)}
            >
              {formatRest(rung)}
            </li>
          ))}
        </ul>
      </div>
      <div className="rest-dial-actions">
        <button type="button" className="rest-dial-set" onClick={() => onSet(value)}>
          Set rest
        </button>
        <button type="button" className="rest-dial-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
