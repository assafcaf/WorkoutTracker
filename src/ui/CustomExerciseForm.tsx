import { useState } from 'react'
import { MUSCLES } from '../data/library'
import type { Muscle } from '../types'
import { Select, Switch } from './controls'
import './CustomExerciseForm.css'

/** What the form edits; the caller adds the id and `createdAt` when it saves. */
export type CustomExerciseValues = {
  name: string
  primaryMuscles: Muscle[]
  secondaryMuscles: Muscle[]
  equipment: string | null
  bodyweight: boolean
  weightStep: number
}

export type CustomExerciseFormProps = {
  /** The Exercise being edited; left out for a new one. */
  initial?: CustomExerciseValues
  /** The equipment values to choose from; "None" is always offered first. */
  equipmentOptions: string[]
  /** A refusal from the last save, shown above the buttons. */
  error?: string | null
  onSave(values: CustomExerciseValues): void
  onCancel(): void
}

const DEFAULT_STEP = '2.5'

function toggle(list: Muscle[], muscle: Muscle): Muscle[] {
  return list.includes(muscle) ? list.filter((m) => m !== muscle) : [...list, muscle]
}

function MusclePicker({
  label,
  value,
  onToggle,
}: {
  label: string
  value: Muscle[]
  onToggle(muscle: Muscle): void
}): JSX.Element {
  return (
    <div role="group" aria-label={label} className="custom-form-muscles">
      {MUSCLES.map((muscle) => (
        <button
          key={muscle}
          type="button"
          className="chip custom-form-chip"
          aria-pressed={value.includes(muscle)}
          onClick={() => onToggle(muscle)}
        >
          {muscle}
        </button>
      ))}
    </div>
  )
}

/**
 * The form that creates or edits a custom Exercise (E19 O19, O21): name, primary and secondary
 * muscles, equipment, Bodyweight and weight step. It validates nothing itself; the catalog
 * service refuses a bad save and the caller passes that message back as `error`.
 */
export function CustomExerciseForm({
  initial,
  equipmentOptions,
  error,
  onSave,
  onCancel,
}: CustomExerciseFormProps): JSX.Element {
  const [name, setName] = useState(initial?.name ?? '')
  const [primary, setPrimary] = useState<Muscle[]>(initial?.primaryMuscles ?? [])
  const [secondary, setSecondary] = useState<Muscle[]>(initial?.secondaryMuscles ?? [])
  const [equipment, setEquipment] = useState(initial?.equipment ?? '')
  const [bodyweight, setBodyweight] = useState(initial?.bodyweight ?? false)
  const [step, setStep] = useState(initial ? String(initial.weightStep) : DEFAULT_STEP)
  const title = initial === undefined ? 'New exercise' : 'Edit exercise'

  return (
    <form
      className="custom-form overlay-panel"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onSubmit={(event) => {
        event.preventDefault()
        onSave({
          name: name.trim(),
          primaryMuscles: primary,
          secondaryMuscles: secondary,
          equipment: equipment === '' ? null : equipment,
          bodyweight,
          weightStep: Number(step),
        })
      }}
    >
      <h1 className="custom-form-heading">{title}</h1>
      <label className="custom-form-field">
        <span className="custom-form-label">Name</span>
        <input
          type="text"
          className="custom-form-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <div className="custom-form-field">
        <span className="custom-form-label">Primary muscles</span>
        <MusclePicker
          label="Primary muscles"
          value={primary}
          onToggle={(muscle) => {
            setPrimary((list) => toggle(list, muscle))
            setSecondary((list) => list.filter((m) => m !== muscle))
          }}
        />
      </div>
      <div className="custom-form-field">
        <span className="custom-form-label">Secondary muscles</span>
        <MusclePicker
          label="Secondary muscles"
          value={secondary}
          onToggle={(muscle) => {
            setSecondary((list) => toggle(list, muscle))
            setPrimary((list) => list.filter((m) => m !== muscle))
          }}
        />
      </div>
      <div className="custom-form-field">
        <span className="custom-form-label">Equipment</span>
        <Select aria-label="Equipment" value={equipment} onChange={(event) => setEquipment(event.target.value)}>
          <option value="">None</option>
          {equipmentOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </div>
      <Switch label="Bodyweight" checked={bodyweight} onChange={setBodyweight} />
      <label className="custom-form-field">
        <span className="custom-form-label">Weight step</span>
        <input
          type="number"
          inputMode="decimal"
          step="any"
          className="custom-form-input"
          aria-label="Weight step"
          value={step}
          onChange={(event) => setStep(event.target.value)}
        />
      </label>
      {error ? (
        <p role="alert" className="custom-form-error">
          {error}
        </p>
      ) : null}
      <div className="custom-form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary">
          Save
        </button>
      </div>
    </form>
  )
}
