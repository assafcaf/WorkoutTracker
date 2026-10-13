import { useState } from 'react'
import { WEIGHT_STEPS, ladderFor, stepWeight } from '../domain/dial'
import { loadText } from '../domain/setText'
import { Keypad } from './Keypad'
import { useCentredRung } from './useCentredRung'
import { useScrub } from './useScrub'
import type { DialVariant } from './dialVariant'
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
   * `column` (the default) is the card with its Rung column and minus/plus. `scrub` is the Set
   * screen's: the number alone, dragged up or down to change it and tapped to type it, with the
   * Rungs either side shown faintly. The column and minus/plus stay in the page for a screen
   * reader and the keyboard, out of sight until focused.
   */
  variant?: DialVariant
}

/** What a value reads: the weight in kg, or on a Bodyweight Exercise `BW`, `BW+10`, `BW−20`. */
function readValue(value: number | null, bodyweight: boolean): string {
  if (bodyweight) return loadText({ weightKg: null, loadKg: value ?? 0 })
  return value === null ? 'BW' : String(value)
}

/** How long a readout is, so the scrub variant can size `82.5` and `BW+10` to fit half the screen. */
function lengthClass(text: string): '4' | 'long' | undefined {
  if (text.length <= 3) return undefined
  return text.length === 4 ? '4' : 'long'
}

/**
 * The weight Dial: its readout, its Rung column and its minus/plus buttons.
 *
 * Three ways into the same value: the column snaps to a rung, the minus/plus buttons step one
 * rung along it, and tapping the readout opens a keypad for a weight off the ladder. In the
 * `scrub` variant a drag on the number steps it too. On a Bodyweight Exercise the same Dial
 * carries the signed Load, its Rungs running from BW−60 to BW+100 through BW (E16-T4), and its
 * keypad takes a sign.
 */
export function WeightDial(props: WeightDialProps): JSX.Element {
  const { exercise, onChange } = props
  const scrub = props.variant === 'scrub'
  const bodyweight = exercise.bodyweight
  const value = bodyweight ? (props.value ?? 0) : props.value
  const [keypadOpen, setKeypadOpen] = useState(false)
  const columnRef = useCentredRung(value)
  const ladder = ladderFor(exercise)
  const loaded = !bodyweight && ladder.length > 0
  const adjustable = ladder.length > 0 && value !== null
  const groupLabel = loaded ? 'Weight (kg)' : 'Weight'
  const unit = value === null || (bodyweight && value === 0) ? '' : 'kg'
  const stepOnce = (from: number, dir: 1 | -1): number => stepWeight(from, dir, exercise)
  const drag = useScrub(adjustable ? value : null, stepOnce, onChange)

  function step(dir: 1 | -1): void {
    if (value === null || ladder.length === 0) return
    onChange(stepWeight(value, dir, exercise))
  }

  const above = adjustable && value !== null ? stepOnce(value, 1) : null
  const below = adjustable && value !== null ? stepOnce(value, -1) : null

  return (
    <div
      className={scrub ? 'dial dial--scrub' : 'dial'}
      data-scrubbing={drag.active ? 'true' : undefined}
      role="group"
      aria-label={groupLabel}
    >
      <h3 className="dial-heading">{groupLabel}</h3>
      <button
        type="button"
        aria-label="Decrease weight"
        className="dial-step icon-btn"
        onClick={() => step(-1)}
      >
        &minus;
      </button>
      <div className="dial-body" {...(scrub && adjustable ? drag.handlers : {})}>
        {scrub ? (
          <span className="dial-ghost" aria-hidden="true">
            {above === null || above === value ? '' : readValue(above, bodyweight)}
          </span>
        ) : null}
        <button
          type="button"
          aria-label="Weight"
          className="dial-readout cell"
          data-length={lengthClass(readValue(value, bodyweight))}
          disabled={!adjustable}
          onClick={() => {
            if (drag.consumeDrag()) return
            setKeypadOpen(true)
          }}
        >
          {readValue(value, bodyweight)}
        </button>
        {scrub ? (
          <span className="dial-ghost" aria-hidden="true">
            {below === null || below === value ? '' : readValue(below, bodyweight)}
          </span>
        ) : null}
        <span className="dial-unit">{unit}</span>
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
        className="dial-step icon-btn"
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
    </div>
  )
}

/** The per-Exercise weight-step control (E16-T11), seated by SetScreen in `.set-dial-controls`. */
export function WeightStepControl(props: {
  step: number
  onStepChange(step: number): void
}): JSX.Element {
  const label = `Step ${props.step} kg`
  return (
    <label className="dial-step-control">
      {label}
      <select
        aria-label={label}
        className="dial-step-select"
        value={props.step}
        onChange={(event) => props.onStepChange(Number(event.target.value))}
      >
        {WEIGHT_STEPS.map((step) => (
          <option key={step} value={step}>
            {step}
          </option>
        ))}
      </select>
    </label>
  )
}
