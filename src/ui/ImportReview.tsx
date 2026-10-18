import { useState } from 'react'
import type { NameProposal } from '../domain/importers/mapping'
import type { LibraryExercise } from '../types'
import { CustomExerciseForm, type CustomExerciseValues } from './CustomExerciseForm'
import { Segmented } from './controls'
import { ExercisePicker } from './ExercisePicker'
import './ImportReview.css'

export type ImportReviewName = { source: string; proposal: NameProposal | null }

export type ImportReviewProps = {
  /** Every distinct source name in the file, with the mapping proposed for it (null: none). */
  names: ImportReviewName[]
  /** The Sessions the file would add; the button names it. */
  sessionCount: number
  /** False when the file states no weight unit: the review asks kg or lbs. */
  unitStated: boolean
  library: LibraryExercise[]
  /** The display name of an Exercise id (catalog or library). */
  exerciseName(id: string): string
  equipmentOptions: string[]
  /** Saves a Custom Exercise; answers its id, or the refusal to show above the form's buttons. */
  createCustom(values: CustomExerciseValues): Promise<{ id: string } | { error: string }>
  /** Hands the choices (null: leave out) and the unit back; the caller does the writing. */
  onImport(choices: Record<string, string | null>, unit: 'kg' | 'lbs'): void
  onCancel(): void
}

/**
 * The import review (E23 O18): props in, choices out. Unmapped names come first and each needs
 * a choice -- pick an Exercise, create a custom one, or leave it out -- before the Import button
 * enables. Mapped names show their proposal with Change. Nothing is written here.
 */
export function ImportReview(props: ImportReviewProps): JSX.Element {
  const { names, sessionCount, unitStated, library, exerciseName, equipmentOptions } = props
  const [choices, setChoices] = useState<Record<string, string | null>>(() => {
    const initial: Record<string, string | null> = {}
    for (const { source, proposal } of names) if (proposal) initial[source] = proposal.id
    return initial
  })
  const [unit, setUnit] = useState<'kg' | 'lbs'>('kg')
  const [picking, setPicking] = useState<string | null>(null)
  const [creating, setCreating] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const unmapped = names.filter((n) => n.proposal === null)
  const mapped = names.filter((n) => n.proposal !== null)
  const ready = unmapped.every((n) => n.source in choices)

  const choose = (source: string, id: string | null) => setChoices((c) => ({ ...c, [source]: id }))

  async function create(values: CustomExerciseValues): Promise<void> {
    if (creating === null) return
    const result = await props.createCustom(values)
    if ('error' in result) {
      setFormError(result.error)
      return
    }
    choose(creating, result.id)
    setCreating(null)
    setFormError(null)
  }

  const summary = (source: string): string => {
    const choice = choices[source]
    if (choice === undefined) return source
    return choice === null ? `${source} → left out` : `${source} → ${exerciseName(choice)}`
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Review import" className="overlay-panel import-review">
      <h2 className="import-review-heading">Review import</h2>
      {unitStated ? null : (
        <div className="import-review-unit">
          <span className="import-review-unit-label">Weights in this file:</span>
          <Segmented
            name="import-unit"
            label="Weight unit"
            value={unit}
            options={[
              { value: 'kg', label: 'kg' },
              { value: 'lbs', label: 'lbs' },
            ]}
            onChange={setUnit}
          />
        </div>
      )}
      <ul className="import-review-rows">
        {unmapped.map(({ source }) => (
          <li key={source} aria-label={source} className="import-review-row">
            <p className="import-review-name">{summary(source)}</p>
            <div className="import-review-actions">
              <button type="button" className="import-review-action btn-secondary" onClick={() => setPicking(source)}>
                Pick exercise
              </button>
              <button
                type="button"
                className="import-review-action btn-secondary"
                onClick={() => {
                  setFormError(null)
                  setCreating(source)
                }}
              >
                Create custom exercise
              </button>
              <button type="button" className="import-review-action btn-secondary" onClick={() => choose(source, null)}>
                Leave out
              </button>
            </div>
          </li>
        ))}
        {mapped.map(({ source, proposal }) => (
          <li key={source} aria-label={source} className="import-review-row">
            <p className="import-review-name">{summary(source)}</p>
            {proposal?.match === 'guess' && choices[source] === proposal.id ? (
              <p className="import-review-guess">Best guess</p>
            ) : null}
            <div className="import-review-actions">
              <button type="button" className="import-review-action btn-quiet" onClick={() => setPicking(source)}>
                Change
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="import-review-foot">
        <button type="button" className="import-review-cancel btn-quiet" onClick={props.onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="import-review-import btn-primary"
          disabled={!ready}
          onClick={() => props.onImport(choices, unit)}
        >
          {`Import ${sessionCount} Session${sessionCount === 1 ? '' : 's'}`}
        </button>
      </div>
      {picking === null ? null : (
        <ExercisePicker
          library={library}
          taken={[]}
          onPick={(id) => {
            choose(picking, id)
            setPicking(null)
          }}
          onClose={() => setPicking(null)}
        />
      )}
      {creating === null ? null : (
        <CustomExerciseForm
          initial={{
            name: creating,
            primaryMuscles: [],
            secondaryMuscles: [],
            equipment: null,
            bodyweight: false,
            weightStep: 2.5,
          }}
          equipmentOptions={equipmentOptions}
          error={formError}
          onSave={(values) => void create(values)}
          onCancel={() => setCreating(null)}
        />
      )}
    </div>
  )
}
