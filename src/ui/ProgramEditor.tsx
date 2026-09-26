import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Exercise, ExercisePlan, LibraryExercise, Program, Workout } from '../types'
import { newPlan, validateProgram } from '../domain/programs'
import type { ProgramFault } from '../domain/programs'
import { useActionBarSlot } from './actionBarSlot'
import { LibraryList } from './LibraryList'
import './ProgramEditor.css'

export type ProgramEditorProps = {
  initial: Program
  isNew: boolean
  resolve: (id: string) => Exercise | undefined
  library: LibraryExercise[]
  gymEquipment: string[] | null
  onSave(p: Program): void
  onCancel(): void
  /** When set, shown above `Save`. */
  saveError?: string | null
}

/**
 * A Plan as the editor holds it: every number as the text in its field, so a field can be
 * cleared and retyped without the draft snapping it to a number in between.
 */
type DraftPlan = {
  exerciseId: string
  sets: string
  minReps: string
  maxReps: string
  rest: string
  /** `''` means no starting weight: the Exercise's own is used. */
  startWeight: string
}

type DraftWorkout = { id: string; name: string; hidden: boolean; plans: DraftPlan[] }

function toDraftPlan(plan: ExercisePlan): DraftPlan {
  return {
    exerciseId: plan.exerciseId,
    sets: String(plan.sets),
    minReps: String(plan.repRange[0]),
    maxReps: String(plan.repRange[1]),
    rest: String(plan.restSeconds),
    startWeight: plan.startWeightKg === undefined ? '' : String(plan.startWeightKg),
  }
}

function toPlan(draft: DraftPlan): ExercisePlan {
  const plan: ExercisePlan = {
    exerciseId: draft.exerciseId,
    sets: Number(draft.sets),
    repRange: [Number(draft.minReps), Number(draft.maxReps)],
    restSeconds: Number(draft.rest),
  }
  if (draft.startWeight.trim() !== '') plan.startWeightKg = Number(draft.startWeight)
  return plan
}

function toWorkout(draft: DraftWorkout): Workout {
  const workout: Workout = { id: draft.id, name: draft.name, exercises: draft.plans.map(toPlan) }
  if (draft.hidden) workout.hidden = true
  return workout
}

let workoutSerial = 0

/** `workout-<uuid>`; a time-and-counter id where `crypto.randomUUID` is missing (Node 18). */
function newWorkoutId(): string {
  const webCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (typeof webCrypto?.randomUUID === 'function') return `workout-${webCrypto.randomUUID()}`
  workoutSerial += 1
  return `workout-${Date.now().toString(36)}-${workoutSerial}`
}

/** `list` with the items at `a` and `b` swapped. */
function swap<T>(list: T[], a: number, b: number): T[] {
  const next = [...list]
  ;[next[a], next[b]] = [next[b], next[a]]
  return next
}

/** A stable DOM id for the message describing the fault at `path` (E9-T8). */
function faultId(path: string): string {
  return `program-editor-fault-${path.replace(/\./g, '-')}`
}

/** The message an accessible description shows for a field, or `undefined` for none (E9-T8). */
function faultMessage(faults: ProgramFault[], path: string): string | undefined {
  return faults.find((f) => f.path === path)?.message
}

/**
 * Builds and rearranges a Program's name, Workouts and Plans on one screen (E9-T7).
 *
 * Hidden Workouts are kept in the draft, in place, but never shown; moving a Workout swaps it
 * with its nearest visible neighbour. `Remove workout` hides a Workout that was in `initial`
 * (a Session may point at it) and drops one added in this edit. `Sessions per week` follows the
 * number of visible Workouts until it is typed into -- or from the start, when an existing
 * Program's value already differs from its Workout count.
 */
export function ProgramEditor({
  initial,
  isNew,
  resolve,
  library,
  gymEquipment,
  onSave,
  onCancel,
  saveError = null,
}: ProgramEditorProps): JSX.Element {
  const actionBar = useActionBarSlot()
  const [name, setName] = useState(initial.name)
  const [workouts, setWorkouts] = useState<DraftWorkout[]>(() =>
    initial.workouts.map((w) => ({
      id: w.id,
      name: w.name,
      hidden: w.hidden === true,
      plans: w.exercises.map(toDraftPlan),
    })),
  )
  const [initialIds] = useState(() => new Set(initial.workouts.map((w) => w.id)))
  const initialVisible = initial.workouts.filter((w) => !w.hidden).length
  const [sessionsText, setSessionsText] = useState<string | null>(() =>
    !isNew && initial.sessionsPerWeek !== initialVisible ? String(initial.sessionsPerWeek) : null,
  )
  const [pickingFor, setPickingFor] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // The Program tab that opened this editor may be scrolled well past the top; land on the
  // Program name instead of wherever that tab's scroll happened to be (fix-editor-scroll).
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const visible = workouts.filter((w) => !w.hidden)
  const sessionsShown = sessionsText ?? String(visible.length)
  // Each visible Workout keeps the index it holds in `workouts` (its `validateProgram` path),
  // alongside the position among visible ones only, used for its "Workout N" label and its
  // Move up/down disabling (E9-T8).
  const visibleWithIndex = workouts.reduce<
    { workout: DraftWorkout; fullIndex: number; displayIndex: number }[]
  >((acc, workout, fullIndex) => {
    if (workout.hidden) return acc
    acc.push({ workout, fullIndex, displayIndex: acc.length })
    return acc
  }, [])

  const draftProgram: Program = {
    ...initial,
    name,
    sessionsPerWeek: Number(sessionsShown),
    workouts: workouts.map(toWorkout),
  }
  const faults = validateProgram(draftProgram, resolve)
  const canSave = faults.length === 0
  const workoutsFault = faultMessage(faults, 'workouts')

  const updateWorkout = (id: string, change: (w: DraftWorkout) => DraftWorkout) =>
    setWorkouts((all) => all.map((w) => (w.id === id ? change(w) : w)))

  const updatePlan = (workoutId: string, index: number, change: Partial<DraftPlan>) =>
    updateWorkout(workoutId, (w) => ({
      ...w,
      plans: w.plans.map((p, j) => (j === index ? { ...p, ...change } : p)),
    }))

  /** Swaps the visible Workout `id` with its visible neighbour `step` (-1 up, +1 down) away. */
  const moveWorkout = (id: string, step: -1 | 1) =>
    setWorkouts((all) => {
      const shown = all.filter((w) => !w.hidden)
      const at = shown.findIndex((w) => w.id === id)
      const other = shown[at + step]
      if (other === undefined) return all
      return swap(all, all.indexOf(shown[at]), all.indexOf(other))
    })

  const removeWorkout = (id: string) =>
    setWorkouts((all) =>
      initialIds.has(id)
        ? all.map((w) => (w.id === id ? { ...w, hidden: true } : w))
        : all.filter((w) => w.id !== id),
    )

  const addWorkout = () =>
    setWorkouts((all) => [...all, { id: newWorkoutId(), name: '', hidden: false, plans: [] }])

  const pick = (exerciseId: string) => {
    if (pickingFor !== null) {
      updateWorkout(pickingFor, (w) => ({
        ...w,
        plans: [...w.plans, toDraftPlan(newPlan(exerciseId))],
      }))
    }
    setPickingFor(null)
    setSearch('')
  }

  const save = () =>
    onSave({
      ...initial,
      name,
      sessionsPerWeek: Number(sessionsShown),
      workouts: workouts.map(toWorkout),
    })

  const query = search.trim().toLowerCase()
  const matches =
    query === '' ? library : library.filter((e) => e.name.toLowerCase().includes(query))

  const actions = (
    <button type="button" className="program-editor-save" onClick={save} disabled={!canSave}>
      Save
    </button>
  )

  return (
    <div className="program-editor">
      <button type="button" className="program-editor-cancel" onClick={onCancel}>
        Cancel
      </button>

      <label className="program-editor-field">
        <span className="program-editor-label">Program name</span>
        <input
          type="text"
          className="program-editor-input"
          value={name}
          aria-describedby={faultMessage(faults, 'name') ? faultId('name') : undefined}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      {faultMessage(faults, 'name') && (
        <p id={faultId('name')} className="program-editor-fault">
          {faultMessage(faults, 'name')}
        </p>
      )}
      <label className="program-editor-field">
        <span className="program-editor-label">Sessions per week</span>
        <input
          type="number"
          inputMode="decimal"
          className="program-editor-input"
          value={sessionsShown}
          aria-describedby={
            faultMessage(faults, 'sessionsPerWeek') ? faultId('sessionsPerWeek') : undefined
          }
          onChange={(event) => setSessionsText(event.target.value)}
        />
      </label>
      {faultMessage(faults, 'sessionsPerWeek') && (
        <p id={faultId('sessionsPerWeek')} className="program-editor-fault">
          {faultMessage(faults, 'sessionsPerWeek')}
        </p>
      )}

      <h2 className="program-editor-heading">Workouts</h2>
      {workoutsFault && <p className="program-editor-fault">{workoutsFault}</p>}

      {visibleWithIndex.map(({ workout, fullIndex, displayIndex }) => {
        const workoutPath = `workouts.${fullIndex}`
        const nameFault = faultMessage(faults, `${workoutPath}.name`)
        const exercisesFault = faultMessage(faults, `${workoutPath}.exercises`)
        return (
        <fieldset key={workout.id} className="program-editor-workout">
          <legend className="program-editor-legend">Workout {displayIndex + 1}</legend>
          <label className="program-editor-field">
            <span className="program-editor-label">Workout name</span>
            <input
              type="text"
              className="program-editor-input"
              value={workout.name}
              aria-describedby={nameFault ? faultId(`${workoutPath}.name`) : undefined}
              onChange={(event) =>
                updateWorkout(workout.id, (w) => ({ ...w, name: event.target.value }))
              }
            />
          </label>
          {nameFault && (
            <p id={faultId(`${workoutPath}.name`)} className="program-editor-fault">
              {nameFault}
            </p>
          )}
          <div className="program-editor-row-actions">
            <button
              type="button"
              className="program-editor-action"
              disabled={displayIndex === 0}
              onClick={() => moveWorkout(workout.id, -1)}
            >
              Move up
            </button>
            <button
              type="button"
              className="program-editor-action"
              disabled={displayIndex === visible.length - 1}
              onClick={() => moveWorkout(workout.id, 1)}
            >
              Move down
            </button>
            <button
              type="button"
              className="program-editor-action"
              onClick={() => removeWorkout(workout.id)}
            >
              Remove workout
            </button>
          </div>

          <ol className="program-editor-plans">
            {workout.plans.map((plan, j) => {
              const exercise = resolve(plan.exerciseId)
              const planPath = `${workoutPath}.exercises.${j}`
              const numberField = (label: string, key: keyof DraftPlan, faultPath: string) => {
                const message = faultMessage(faults, faultPath)
                return (
                <label className="program-editor-field">
                  <span className="program-editor-label">{label}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    className="program-editor-input"
                    value={plan[key]}
                    aria-describedby={message ? faultId(faultPath) : undefined}
                    onChange={(event) =>
                      updatePlan(workout.id, j, { [key]: event.target.value })
                    }
                  />
                </label>
                )
              }
              const repRangeMessage = faultMessage(faults, `${planPath}.repRange`)
              return (
                <li key={`${plan.exerciseId}-${j}`} className="program-editor-plan">
                  <p className="program-editor-plan-name">{exercise?.name ?? plan.exerciseId}</p>
                  <div className="program-editor-plan-fields">
                    {numberField('Sets', 'sets', `${planPath}.sets`)}
                    {numberField('Min reps', 'minReps', `${planPath}.repRange`)}
                    {numberField('Max reps', 'maxReps', `${planPath}.repRange`)}
                    {numberField('Rest (s)', 'rest', `${planPath}.restSeconds`)}
                    {exercise?.bodyweight ? null : (
                      <label className="program-editor-field">
                        <span className="program-editor-label">Starting weight (kg)</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          className="program-editor-input"
                          value={plan.startWeight}
                          placeholder={
                            exercise?.startWeight == null ? undefined : String(exercise.startWeight)
                          }
                          aria-describedby={
                            faultMessage(faults, `${planPath}.startWeightKg`)
                              ? faultId(`${planPath}.startWeightKg`)
                              : undefined
                          }
                          onChange={(event) =>
                            updatePlan(workout.id, j, { startWeight: event.target.value })
                          }
                        />
                      </label>
                    )}
                  </div>
                  {repRangeMessage && (
                    <p id={faultId(`${planPath}.repRange`)} className="program-editor-fault">
                      {repRangeMessage}
                    </p>
                  )}
                  {faultMessage(faults, `${planPath}.sets`) && (
                    <p id={faultId(`${planPath}.sets`)} className="program-editor-fault">
                      {faultMessage(faults, `${planPath}.sets`)}
                    </p>
                  )}
                  {faultMessage(faults, `${planPath}.restSeconds`) && (
                    <p id={faultId(`${planPath}.restSeconds`)} className="program-editor-fault">
                      {faultMessage(faults, `${planPath}.restSeconds`)}
                    </p>
                  )}
                  {faultMessage(faults, `${planPath}.startWeightKg`) && (
                    <p
                      id={faultId(`${planPath}.startWeightKg`)}
                      className="program-editor-fault"
                    >
                      {faultMessage(faults, `${planPath}.startWeightKg`)}
                    </p>
                  )}
                  <div className="program-editor-row-actions">
                    <button
                      type="button"
                      className="program-editor-action"
                      disabled={j === 0}
                      onClick={() =>
                        updateWorkout(workout.id, (w) => ({ ...w, plans: swap(w.plans, j, j - 1) }))
                      }
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      className="program-editor-action"
                      disabled={j === workout.plans.length - 1}
                      onClick={() =>
                        updateWorkout(workout.id, (w) => ({ ...w, plans: swap(w.plans, j, j + 1) }))
                      }
                    >
                      Move down
                    </button>
                    <button
                      type="button"
                      className="program-editor-action"
                      onClick={() =>
                        updateWorkout(workout.id, (w) => ({
                          ...w,
                          plans: w.plans.filter((_, k) => k !== j),
                        }))
                      }
                    >
                      Remove
                    </button>
                  </div>
                </li>
              )
            })}
          </ol>

          {exercisesFault && <p className="program-editor-fault">{exercisesFault}</p>}

          <button
            type="button"
            className="program-editor-add"
            onClick={() => setPickingFor(workout.id)}
          >
            Add exercise
          </button>
        </fieldset>
        )
      })}

      <button type="button" className="program-editor-add" onClick={addWorkout}>
        Add workout
      </button>

      {saveError === null ? null : (
        <p className="program-editor-error" role="alert">
          {saveError}
        </p>
      )}

      {actionBar === null ? actions : createPortal(actions, actionBar)}

      {pickingFor === null ? null : (
        <div
          className="program-editor-picker overlay-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Add exercise"
        >
          <h2 className="program-editor-picker-heading">Add exercise</h2>
          <button
            type="button"
            className="program-editor-cancel"
            onClick={() => {
              setPickingFor(null)
              setSearch('')
            }}
          >
            Close
          </button>
          <input
            type="search"
            aria-label="Search exercises"
            placeholder="Search exercises"
            className="library-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <LibraryList
            library={matches}
            onOpen={pick}
            onPick={pick}
            gymEquipment={gymEquipment}
          />
        </div>
      )}
    </div>
  )
}
