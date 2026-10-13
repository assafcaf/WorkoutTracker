import { useState } from 'react'
import { WEIGHT_STEPS, ladderFor, stepWeight } from '../domain/dial'
import { loadText } from '../domain/setText'
import { Keypad } from './Keypad'
import { useCentredRung } from './useCentredRung'
import type { Exercise } from '../types'
import './dial.css'

export type WeightDialProps = {
  exercise: Exercise
  /**
   * The weight in kg on a loaded Exercise. On a Bodyweight Exercise (E16-T4) it is the signed
   * Load in kg instead: 0 is plain bodyweight and reads "BW", and null reads as 0.
   */
  value: number | null
  /** Told the weight chosen; on a Bodyweight Exercise, the signed Load. */
  onChange(value: number | null): void
  /**
   * Told the weight step just chosen from the step control (E8-T8). Optional -- and, when
   * given but the Exercise is Bodyweight, ignored -- so the step control itself only renders
   * for a loaded Exercise when a caller offers somewhere to send it.
   */
  onStepChange?(step: number): void
}

/** What a value reads: the weight in kg, or on a Bodyweight Exercise `BW`, `BW+10`, `BW−20`. */
function readValue(value: number | null, bodyweight: boolean): string {
  if (bodyweight) return loadText({ weightKg: null, loadKg: value ?? 0 })
  return value === null ? 'BW' : String(value)
}

/**
 * The weight scroll-snap column with its minus/plus buttons and its readout.
 *
 * Three ways into the same value: the column snaps to a rung, the minus/plus buttons step one
 * rung along it, and the readout opens a keypad for a weight off the ladder. On a Bodyweight
 * Exercise the same Dial carries the signed Load, its Rungs running from BW−60 to BW+100
 * through BW (E16-T4), and its keypad takes a sign.
 */
export function WeightDial(props: WeightDialProps): JSX.Element {
  const { exercise, onChange, onStepChange } = props
  const bodyweight = exercise.bodyweight
  const value = bodyweight ? (props.value ?? 0) : props.value
  const [keypadOpen, setKeypadOpen] = useState(false)
  const columnRef = useCentredRung(value)
  const ladder = ladderFor(exercise)
  const loaded = !bodyweight && ladder.length > 0
  const adjustable = ladder.length > 0 && value !== null
  const groupLabel = loaded ? 'Weight (kg)' : 'Weight'
  const stepLabel = `Step ${exercise.weightStep} kg`
  const unit = value === null || (bodyweight && value === 0) ? '' : 'kg'

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
          {readValue(value, bodyweight)}
        </button>
        <span className="dial-unit">{unit}</span>
        {loaded ? (
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
                {readValue(rung, bodyweight)}
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
          signed={bodyweight}
          onCommit={(entered) => {
            onChange(entered)
            setKeypadOpen(false)
          }}
          onCancel={() => setKeypadOpen(false)}
        />
      ) : null}
      {loaded && onStepChange !== undefined ? (
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
