import './Stepper.css'

export type StepperProps = {
  /** What it sets, said by its buttons: "Decrease Sets", "Increase Sets". */
  label: string
  /** The value as shown: "4", "1:30", "62.5 kg". */
  value: string
  onDecrease(): void
  onIncrease(): void
  canDecrease?: boolean
  canIncrease?: boolean
  /** Ids of messages that describe the value (a validation fault). */
  describedBy?: string
}

/**
 * A − value + stepper (DX-17, DX-23): constrains a number to its steps instead of a free field
 * (H5). Each button is at least 44 × 44; the value between them is announced as it changes.
 */
export function Stepper({
  label,
  value,
  onDecrease,
  onIncrease,
  canDecrease = true,
  canIncrease = true,
  describedBy,
}: StepperProps): JSX.Element {
  return (
    <span className="stepper" role="group" aria-label={label} aria-describedby={describedBy}>
      <button
        type="button"
        className="stepper-step btn-secondary"
        aria-label={`Decrease ${label}`}
        disabled={!canDecrease}
        onClick={onDecrease}
      >
        −
      </button>
      <output className="stepper-value" aria-live="polite" aria-label={label}>
        {value}
      </output>
      <button
        type="button"
        className="stepper-step btn-secondary"
        aria-label={`Increase ${label}`}
        disabled={!canIncrease}
        onClick={onIncrease}
      >
        +
      </button>
    </span>
  )
}
