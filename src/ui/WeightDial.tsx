import { useState } from 'react'
import { WEIGHT_STEPS, buildLadder, stepWeight } from '../domain/dial'
import { Keypad } from './Keypad'
import { useCentredRung } from './useCentredRung'
import type { Exercise } from '../types'
import './dial.css'

export type WeightDialProps = {
  exercise: Exercise
  value: number | null
  onChange(value: number | null): void
  /**
   * Told the weight step just chosen from the step control (E8-T8). Optional -- and, when
   * given but the Exercise is Bodyweight, ignored -- so the step control itself only renders
   * for a loaded Exercise when a caller offers somewhere to send it.
   */
  onStepChange?(step: number): void
}

/** What the readout shows: the weight in kg, or "BW" when the exercise carries no plate. */
function readWeight(value: number | null): string {
  return value === null ? 'BW' : String(value)
}

/**
 * The weight scroll-snap column with its minus/plus buttons and its readout.
 *
 * Three ways into the same value: the column snaps to a rung, the minus/plus buttons step one
 * rung along it, and the readout opens a keypad for a weight off the ladder. A bodyweight
 * exercise has no ladder, so it reads "BW" and none of the three moves it.
 */
export function WeightDial(props: WeightDialProps): JSX.Element {
  const { exercise, value, onChange, onStepChange } = props
  const [keypadOpen, setKeypadOpen] = useState(false)
  const columnRef = useCentredRung(value)
  const ladder = buildLadder(exercise)
  const adjustable = ladder.length > 0 && value !== null
  const groupLabel = ladder.length > 0 ? 'Weight (kg)' : 'Weight'
  const stepLabel = `Step ${exercise.weightStep} kg`

  function step(dir: 1 | -1): void {
    if (value === null || ladder.length === 0) return
    onChange(stepWeight(value, dir, exercise))
  }

  return (
    <div className="dial" role="group" aria-label={groupLabel}>
      <h3 className="dial-heading">{groupLabel}</h3>
      <button
        type="button"
        aria-label="Decrease weight"
        className="dial-step"
        onClick={() => step(-1)}
      >
        &minus;
      </button>
      <div className="dial-body">
        <button
          type="button"
          aria-label="Weight"
          className="dial-readout"
          disabled={!adjustable}
          onClick={() => setKeypadOpen(true)}
        >
          {readWeight(value)}
        </button>
        <span className="dial-unit">{value === null ? '' : 'kg'}</span>
        {ladder.length > 0 ? (
          <button
            type="button"
            aria-label="Type weight"
            className="dial-type"
            disabled={!adjustable}
            onClick={() => setKeypadOpen(true)}
          >
            Type weight
          </button>
        ) : null}
        {ladder.length > 0 ? (
          <ul role="listbox" aria-label="Weight ladder" className="dial-column" ref={columnRef}>
            {ladder.map((rung) => (
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
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Increase weight"
        className="dial-step"
        onClick={() => step(1)}
      >
        +
      </button>
      {keypadOpen ? (
        <Keypad
          label="Weight"
          value={value}
          onCommit={(entered) => {
            onChange(entered)
            setKeypadOpen(false)
          }}
          onCancel={() => setKeypadOpen(false)}
        />
      ) : null}
      {ladder.length > 0 && onStepChange !== undefined ? (
        <label className="dial-step-control">
          {stepLabel}
          <select
            aria-label={stepLabel}
            className="dial-step-select"
            value={exercise.weightStep}
            onChange={(event) => onStepChange(Number(event.target.value))}
          >
            {WEIGHT_STEPS.map((step) => (
              <option key={step} value={step}>
                {step}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  )
}
