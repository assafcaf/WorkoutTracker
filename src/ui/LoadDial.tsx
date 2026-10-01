import { loadLadder } from '../domain/dial'
import { loadText } from '../domain/setText'
import { useCentredRung } from './useCentredRung'
import './dial.css'

export type LoadDialProps = {
  /** The Exercise's weight step: the Rungs' spacing from -60 to +100 kg. */
  step: number
  /** The signed load in kg; 0 is plain bodyweight and reads `BW`. */
  value: number
  onChange(value: number): void
}

/** What a Load reads: `BW`, `BW+10`, `BW−20` (true minus sign). */
function readLoad(value: number): string {
  return loadText({ weightKg: null, loadKg: value })
}

/**
 * The Load Dial under the reps Dial on a Bodyweight Exercise (E14-T14): a group "Load" with
 * "Decrease load" / "Increase load", a readout button "Load" (`BW`, `BW+10`, `BW−20`) and a
 * listbox "Load ladder" of `loadLadder(step)` Rungs.
 */
export function LoadDial(props: LoadDialProps): JSX.Element {
  const { step, value, onChange } = props
  const columnRef = useCentredRung(value)
  const ladder = loadLadder(step)

  /** One Rung along the ladder in `dir`, a value off it first snapped down to the Rung below. */
  function move(dir: 1 | -1): void {
    let floor = -1
    for (let i = 0; i < ladder.length && ladder[i] <= value; i++) floor = i
    const next = Math.min(Math.max(floor + dir, 0), ladder.length - 1)
    onChange(ladder[next])
  }

  return (
    <div className="dial" role="group" aria-label="Load">
      <h3 className="dial-heading">Load</h3>
      <button type="button" aria-label="Decrease load" className="dial-step" onClick={() => move(-1)}>
        &minus;
      </button>
      <div className="dial-body">
        <button type="button" aria-label="Load" className="dial-readout">
          {readLoad(value)}
        </button>
        <span className="dial-unit">{value === 0 ? '' : 'kg'}</span>
        <ul role="listbox" aria-label="Load ladder" className="dial-column" ref={columnRef}>
          {ladder.map((rung) => (
            <li
              key={rung}
              role="option"
              aria-selected={rung === value}
              className="dial-rung"
              onClick={() => onChange(rung)}
            >
              {readLoad(rung)}
            </li>
          ))}
        </ul>
      </div>
      <button type="button" aria-label="Increase load" className="dial-step" onClick={() => move(1)}>
        +
      </button>
    </div>
  )
}
