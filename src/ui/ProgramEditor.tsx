import { useEffect, useMemo, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { Exercise, ExercisePlan, LibraryExercise, Program, Workout } from '../types'
import { workoutEstimate } from '../domain/dashboard'
import { newPlan, validateProgram } from '../domain/programs'
import type { ProgramFault } from '../domain/programs'
import { matchesQuery } from '../domain/search'
import { exerciseFamily, familyImpact, type FamilyImpact } from '../domain/programVolume'
import { loadText } from '../domain/setText'
import { LibraryList } from './LibraryList'
import { Switch } from './controls'
import { Icon } from './icons'
import { moveTo } from './program/listMoves'
import { FAMILY_LABELS, wholeCount } from './program/planText'
import './program/ProgramFamily.css'
import './ProgramEditor.css'

export type ProgramEditorProps = {
  initial: Program
  isNew: boolean
  resolve: (id: string) => Exercise | undefined
  library: LibraryExercise[]
  gymEquipment: string[] | null
  onSave(p: Program): void
  onCancel(): void
  /** When set, shown under the editor's bar. */
  saveError?: string | null
  /**
   * The bar's title. Defaults to `New program` for a new Program and `Edit <name>` otherwise
   * (Progress Dashboard S7b: "Edit A/B Split").
   */
  title?: string
}

/**
 * A Plan as the editor holds it: every number as the text in its field, so a field can be
 * cleared and retyped without the draft snapping it to a number in between. `uid` names the
 * row across moves, so a dragged row keeps its focus; it is never saved.
 */
type DraftPlan = {
  uid: string
  exerciseId: string
  sets: string
  minReps: string
  maxReps: string
  rest: string
  /** `''` means no starting weight: the Exercise's own is used. */
  startWeight: string
  amrapLast: boolean
}

type DraftWorkout = { id: string; name: string; hidden: boolean; plans: DraftPlan[] }

/** What the exercise picker is open for: adding to a Workout, or swapping one of its Plans. */
type Picking = { workoutId: string; swapUid: string | null }

let planSerial = 0

function toDraftPlan(plan: ExercisePlan): DraftPlan {
  planSerial += 1
  return {
    uid: `plan-${planSerial}`,
    exerciseId: plan.exerciseId,
    sets: String(plan.sets),
    minReps: String(plan.repRange[0]),
    maxReps: String(plan.repRange[1]),
    rest: String(plan.restSeconds),
    startWeight: plan.startWeightKg === undefined ? '' : String(plan.startWeightKg),
    amrapLast: plan.amrapLast === true,
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
  if (draft.amrapLast) plan.amrapLast = true
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

/** A number typed into a field, or 0 while it is not one -- for the live estimates only. */
function typed(text: string): number {
  const value = Number(text)
  return Number.isFinite(value) ? value : 0
}

/** The top of the impact chart's axis: 10, or the next ten past the larger bar. */
function axisTop(impact: FamilyImpact): number {
  return Math.max(10, Math.ceil(Math.max(impact.before, impact.after) / 10) * 10)
}

/**
 * Builds and rearranges a Program's name, Workouts and Plans on one screen (E9-T7), laid out as
 * Progress Dashboard S7b: a `Cancel · title · Save` bar, a card per Workout with its live size
 * ("24 sets · ~55 min"), one row per Plan -- drag handle, name, Sets / Reps / Rest / kg cells and
 * an options menu (move, swap, Last set AMRAP, remove) -- and, once an edit changes the week, a
 * sticky "Impact on weekly volume" card.
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
  title,
}: ProgramEditorProps): JSX.Element {
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
  // Each initial Plan's set count by its row, for the impact card's "sets 4 → 5".
  const [initialSets] = useState(
    () => new Map(workouts.flatMap((w) => w.plans.map((p) => [p.uid, p.sets] as const))),
  )
  const initialVisible = initial.workouts.filter((w) => !w.hidden).length
  const [sessionsText, setSessionsText] = useState<string | null>(() =>
    !isNew && initial.sessionsPerWeek !== initialVisible ? String(initial.sessionsPerWeek) : null,
  )
  const [picking, setPicking] = useState<Picking | null>(null)
  const [search, setSearch] = useState('')
  const [openMenus, setOpenMenus] = useState<Set<string>>(() => new Set())
  const [lastEdited, setLastEdited] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ workoutId: string; from: number; to: number } | null>(null)
  const [focusUid, setFocusUid] = useState<string | null>(null)
  const libraryById = useMemo(() => new Map(library.map((entry) => [entry.id, entry] as const)), [library])

  // The Program tab that opened this editor may be scrolled well past the top; land on the
  // Program name instead of wherever that tab's scroll happened to be (fix-editor-scroll).
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // A row moved from the keyboard keeps its handle focused at its new place.
  useEffect(() => {
    if (focusUid === null) return
    document.querySelector<HTMLElement>(`[data-handle="${focusUid}"]`)?.focus()
    setFocusUid(null)
  }, [focusUid])

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
  const impacts = familyImpact(initial, draftProgram, resolve, libraryById)

  const toggleMenu = (key: string) =>
    setOpenMenus((open) => {
      const next = new Set(open)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const updateWorkout = (id: string, change: (w: DraftWorkout) => DraftWorkout) =>
    setWorkouts((all) => all.map((w) => (w.id === id ? change(w) : w)))

  const updatePlan = (workoutId: string, index: number, change: Partial<DraftPlan>) =>
    updateWorkout(workoutId, (w) => ({
      ...w,
      plans: w.plans.map((p, j) => (j === index ? { ...p, ...change } : p)),
    }))

  const movePlan = (workoutId: string, from: number, to: number) =>
    updateWorkout(workoutId, (w) => ({ ...w, plans: moveTo(w.plans, from, to) }))

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

  const closePicker = () => {
    setPicking(null)
    setSearch('')
  }

  const pick = (exerciseId: string) => {
    if (picking !== null) {
      const { workoutId, swapUid } = picking
      if (swapUid === null) {
        const added = toDraftPlan(newPlan(exerciseId))
        updateWorkout(workoutId, (w) => ({ ...w, plans: [...w.plans, added] }))
        setLastEdited(added.uid)
      } else {
        // A swap keeps the row's numbers; a starting weight belonged to the old Exercise.
        updateWorkout(workoutId, (w) => ({
          ...w,
          plans: w.plans.map((p) => (p.uid === swapUid ? { ...p, exerciseId, startWeight: '' } : p)),
        }))
        setLastEdited(swapUid)
      }
    }
    closePicker()
  }

  const save = () => onSave(draftProgram)

  /** The row under the pointer while a handle is dragged, by the rows' vertical midpoints. */
  const dropIndex = (event: ReactPointerEvent<HTMLElement>): number | null => {
    const list = event.currentTarget.closest('ol')
    if (list === null) return null
    const rows = [...list.children] as HTMLElement[]
    const below = rows.findIndex((row) => {
      const box = row.getBoundingClientRect()
      return event.clientY < box.top + box.height / 2
    })
    return below === -1 ? rows.length - 1 : below
  }

  const handleKey = (workoutId: string, index: number, count: number, uid: string) =>
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
      if (step === 0) return
      event.preventDefault()
      const to = index + step
      if (to < 0 || to >= count) return
      movePlan(workoutId, index, to)
      setFocusUid(uid)
    }

  const matches = library.filter((e) => matchesQuery(e.name, search))
  const pickerTitle = picking?.swapUid ? 'Swap exercise' : 'Add exercise'

  const impact =
    impacts.length === 0
      ? null
      : (() => {
          const edited = workouts.flatMap((w) => w.plans).find((p) => p.uid === lastEdited)
          const editedFamily = edited ? exerciseFamily(resolve(edited.exerciseId), libraryById) : null
          const headline = impacts.find((one) => one.family === editedFamily) ?? impacts[0]
          const wasSets = edited ? initialSets.get(edited.uid) : undefined
          const caption =
            edited && wasSets !== undefined && wasSets !== edited.sets
              ? `${resolve(edited.exerciseId)?.name ?? edited.exerciseId} · sets ${wasSets} → ${edited.sets}`
              : null
          return { headline, caption }
        })()

  return (
    <div className={impact ? 'program-editor program-editor-with-impact' : 'program-editor'}>
      <div className="program-editor-bar">
        <button type="button" className="program-editor-cancel btn-quiet" onClick={onCancel}>
          Cancel
        </button>
        <h1 className="program-editor-title">{title ?? (isNew ? 'New program' : `Edit ${initial.name}`)}</h1>
        <button type="button" className="program-editor-save btn-quiet" onClick={save} disabled={!canSave}>
          Save
        </button>
      </div>

      {saveError === null ? null : (
        <p className="program-editor-error" role="alert">
          {saveError}
        </p>
      )}

      <div className="program-editor-program">
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
            className="program-editor-input program-editor-input-short"
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
      </div>

      <h2 className="program-editor-heading">Workouts</h2>
      {workoutsFault && <p className="program-editor-fault">{workoutsFault}</p>}

      {visibleWithIndex.map(({ workout, fullIndex, displayIndex }) => {
        const workoutPath = `workouts.${fullIndex}`
        const nameFault = faultMessage(faults, `${workoutPath}.name`)
        const exercisesFault = faultMessage(faults, `${workoutPath}.exercises`)
        const estimate = workoutEstimate({
          id: workout.id,
          name: workout.name,
          exercises: workout.plans.map((p) => ({
            exerciseId: p.exerciseId,
            sets: typed(p.sets),
            repRange: [typed(p.minReps), typed(p.maxReps)],
            restSeconds: typed(p.rest),
          })),
        })
        const label = workout.name === '' ? `Workout ${displayIndex + 1}` : workout.name
        const workoutMenu = `workout:${workout.id}`
        const workoutMenuOpen = openMenus.has(workoutMenu)
        return (
        <fieldset key={workout.id} className="program-editor-workout">
          <legend className="program-editor-legend">Workout {displayIndex + 1}</legend>
          <div className="program-editor-workout-head">
            <input
              type="text"
              className="program-editor-workout-name"
              aria-label="Workout name"
              placeholder={`Workout ${displayIndex + 1}`}
              value={workout.name}
              aria-describedby={nameFault ? faultId(`${workoutPath}.name`) : undefined}
              onChange={(event) =>
                updateWorkout(workout.id, (w) => ({ ...w, name: event.target.value }))
              }
            />
            <span className="program-editor-workout-size">{`${estimate.sets} sets · ~${estimate.minutes} min`}</span>
            <button
              type="button"
              className="program-editor-more icon-btn"
              aria-label={`Options for ${label}`}
              aria-expanded={workoutMenuOpen}
              onClick={() => toggleMenu(workoutMenu)}
            >
              <Icon name="Ellipsis" size={18} />
            </button>
          </div>
          {nameFault && (
            <p id={faultId(`${workoutPath}.name`)} className="program-editor-fault">
              {nameFault}
            </p>
          )}
          {workoutMenuOpen && (
            <div className="program-editor-menu" role="group" aria-label={`Options for ${label}`}>
              <button
                type="button"
                className="program-editor-action btn-quiet"
                disabled={displayIndex === 0}
                onClick={() => moveWorkout(workout.id, -1)}
              >
                Move up
              </button>
              <button
                type="button"
                className="program-editor-action btn-quiet"
                disabled={displayIndex === visible.length - 1}
                onClick={() => moveWorkout(workout.id, 1)}
              >
                Move down
              </button>
              <button
                type="button"
                className="program-editor-action btn-danger"
                onClick={() => removeWorkout(workout.id)}
              >
                Remove workout
              </button>
            </div>
          )}

          {workout.plans.length > 0 && (
            <div className="program-editor-columns" aria-hidden="true">
              <span className="program-editor-col-handle" />
              <span className="program-editor-col-name">Exercise</span>
              <span className="program-editor-col program-editor-col-sets">Sets</span>
              <span className="program-editor-col program-editor-col-reps">Reps</span>
              <span className="program-editor-col program-editor-col-rest">Rest, s</span>
              <span className="program-editor-col program-editor-col-kg">kg</span>
              <span className="program-editor-col-more" />
            </div>
          )}

          <ol className="program-editor-plans">
            {workout.plans.map((plan, j) => {
              const exercise = resolve(plan.exerciseId)
              const exerciseName = exercise?.name ?? plan.exerciseId
              const planPath = `${workoutPath}.exercises.${j}`
              const planMenu = `plan:${plan.uid}`
              const planMenuOpen = openMenus.has(planMenu)
              const describedBy = (path: string) =>
                faultMessage(faults, path) ? faultId(path) : undefined
              const repRangeMessage = faultMessage(faults, `${planPath}.repRange`)
              const isDropTarget = drag !== null && drag.workoutId === workout.id && drag.to === j && drag.from !== j
              return (
                <li
                  key={plan.uid}
                  className="program-editor-plan"
                  data-dragging={drag !== null && drag.workoutId === workout.id && drag.from === j ? 'true' : undefined}
                  data-drop-target={isDropTarget ? 'true' : undefined}
                >
                  <div className="program-editor-plan-row">
                    <button
                      type="button"
                      className="program-editor-handle icon-btn"
                      aria-label={`Reorder ${exerciseName}`}
                      aria-describedby="program-editor-handle-hint"
                      data-handle={plan.uid}
                      onKeyDown={handleKey(workout.id, j, workout.plans.length, plan.uid)}
                      onPointerDown={(event) => {
                        event.currentTarget.setPointerCapture?.(event.pointerId)
                        setDrag({ workoutId: workout.id, from: j, to: j })
                      }}
                      onPointerMove={(event) => {
                        if (drag === null || drag.workoutId !== workout.id) return
                        const to = dropIndex(event)
                        if (to !== null && to !== drag.to) setDrag({ ...drag, to })
                      }}
                      onPointerUp={() => {
                        if (drag !== null && drag.workoutId === workout.id) movePlan(workout.id, drag.from, drag.to)
                        setDrag(null)
                      }}
                      onPointerCancel={() => setDrag(null)}
                    >
                      <Icon name="Grip" size={16} />
                    </button>
                    <span
                      className="muscle-dot program-family"
                      data-family={exerciseFamily(exercise, libraryById) ?? undefined}
                      aria-hidden="true"
                    />
                    <p className="program-editor-plan-name">{exerciseName}</p>
                    <label className="program-editor-cell program-editor-cell-sets">
                      <span className="program-editor-sr">Sets</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        className="program-editor-cell-input"
                        value={plan.sets}
                        aria-describedby={describedBy(`${planPath}.sets`)}
                        onChange={(event) => {
                          updatePlan(workout.id, j, { sets: event.target.value })
                          setLastEdited(plan.uid)
                        }}
                      />
                    </label>
                    <div className="program-editor-cell program-editor-cell-reps">
                      <label className="program-editor-rep">
                        <span className="program-editor-sr">Min reps</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          className="program-editor-cell-input"
                          value={plan.minReps}
                          aria-describedby={describedBy(`${planPath}.repRange`)}
                          onChange={(event) => updatePlan(workout.id, j, { minReps: event.target.value })}
                        />
                      </label>
                      <span className="program-editor-rep-dash" aria-hidden="true">
                        –
                      </span>
                      <label className="program-editor-rep">
                        <span className="program-editor-sr">Max reps</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          className="program-editor-cell-input"
                          value={plan.maxReps}
                          aria-describedby={describedBy(`${planPath}.repRange`)}
                          onChange={(event) => updatePlan(workout.id, j, { maxReps: event.target.value })}
                        />
                      </label>
                    </div>
                    <label className="program-editor-cell program-editor-cell-rest">
                      <span className="program-editor-sr">Rest (s)</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        className="program-editor-cell-input"
                        value={plan.rest}
                        aria-describedby={describedBy(`${planPath}.restSeconds`)}
                        onChange={(event) => updatePlan(workout.id, j, { rest: event.target.value })}
                      />
                    </label>
                    {exercise?.bodyweight ? (
                      <span className="program-editor-cell program-editor-cell-kg program-editor-cell-static">
                        {loadText({ weightKg: null, loadKg: exercise.startLoadKg })}
                      </span>
                    ) : (
                      <label className="program-editor-cell program-editor-cell-kg">
                        <span className="program-editor-sr">Starting weight (kg)</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          className="program-editor-cell-input"
                          value={plan.startWeight}
                          placeholder={
                            exercise?.startWeight == null ? undefined : String(exercise.startWeight)
                          }
                          aria-describedby={describedBy(`${planPath}.startWeightKg`)}
                          onChange={(event) =>
                            updatePlan(workout.id, j, { startWeight: event.target.value })
                          }
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      className="program-editor-more icon-btn"
                      aria-label={`Options for ${exerciseName}`}
                      aria-expanded={planMenuOpen}
                      onClick={() => toggleMenu(planMenu)}
                    >
                      <Icon name="Ellipsis" size={18} />
                    </button>
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
                  {planMenuOpen && (
                    <div className="program-editor-menu" role="group" aria-label={`Options for ${exerciseName}`}>
                      <div className="program-editor-menu-switch">
                        <Switch
                          checked={plan.amrapLast}
                          onChange={(next) => updatePlan(workout.id, j, { amrapLast: next })}
                          label="Last set AMRAP"
                        />
                      </div>
                      <div className="program-editor-menu-actions">
                        <button
                          type="button"
                          className="program-editor-action btn-quiet"
                          disabled={j === 0}
                          onClick={() => movePlan(workout.id, j, j - 1)}
                        >
                          Move up
                        </button>
                        <button
                          type="button"
                          className="program-editor-action btn-quiet"
                          disabled={j === workout.plans.length - 1}
                          onClick={() => movePlan(workout.id, j, j + 1)}
                        >
                          Move down
                        </button>
                        <button
                          type="button"
                          className="program-editor-action btn-quiet"
                          onClick={() => setPicking({ workoutId: workout.id, swapUid: plan.uid })}
                        >
                          Swap exercise
                        </button>
                        <button
                          type="button"
                          className="program-editor-action btn-danger"
                          onClick={() => {
                            updateWorkout(workout.id, (w) => ({
                              ...w,
                              plans: w.plans.filter((_, k) => k !== j),
                            }))
                            setLastEdited(null)
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>

          {exercisesFault && <p className="program-editor-fault">{exercisesFault}</p>}

          <button
            type="button"
            className="program-editor-add btn-quiet"
            onClick={() => setPicking({ workoutId: workout.id, swapUid: null })}
          >
            <Icon name="Plus" size={20} />
            Add exercise
          </button>
        </fieldset>
        )
      })}

      <button type="button" className="program-editor-add-workout btn-secondary" onClick={addWorkout}>
        Add workout
      </button>

      <p id="program-editor-handle-hint" className="program-editor-sr">
        Drag, or press the up and down arrow keys, to move the exercise.
      </p>

      {impact === null ? null : (
        <aside className="program-editor-impact" aria-label="Impact on weekly volume">
          <div className="program-editor-impact-head">
            <span className="program-editor-impact-label">Impact on weekly volume</span>
            {impact.caption ? <span className="program-editor-impact-caption">{impact.caption}</span> : null}
          </div>
          <p className="program-editor-impact-headline">
            <span
              className="muscle-dot program-family"
              data-family={impact.headline.family}
              aria-hidden="true"
            />
            {`${FAMILY_LABELS[impact.headline.family]} ${wholeCount(impact.headline.before)} → ${wholeCount(impact.headline.after)} sets/week`}
          </p>
          <ImpactBars impact={impact.headline} />
        </aside>
      )}

      {picking === null ? null : (
        <div
          className="program-editor-picker overlay-panel"
          role="dialog"
          aria-modal="true"
          aria-label={pickerTitle}
        >
          <h2 className="program-editor-picker-heading">{pickerTitle}</h2>
          <button type="button" className="program-editor-cancel btn-quiet" onClick={closePicker}>
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

/** The impact card's Before / After bars on a 0 to `axisTop` scale, ticked at its ends and middle. */
function ImpactBars({ impact }: { impact: FamilyImpact }): JSX.Element {
  const top = axisTop(impact)
  const bars = [
    { label: 'Before', value: impact.before, family: undefined },
    { label: 'After', value: impact.after, family: impact.family },
  ]
  return (
    <div className="program-editor-impact-chart">
      {bars.map((bar) => (
        <div key={bar.label} className="program-editor-impact-row">
          <span className="program-editor-impact-bar-label">{bar.label}</span>
          <span className="program-editor-impact-track">
            <span
              className={bar.family ? 'program-editor-impact-bar program-family' : 'program-editor-impact-bar'}
              data-family={bar.family}
              style={{ width: `${(Math.min(bar.value, top) / top) * 100}%` }}
            />
            <span className="program-editor-impact-value">{wholeCount(bar.value)}</span>
          </span>
        </div>
      ))}
      <div className="program-editor-impact-axis" aria-hidden="true">
        <span className="program-editor-impact-tick">0</span>
        <span className="program-editor-impact-tick">{top / 2}</span>
        <span className="program-editor-impact-tick">{top}</span>
      </div>
    </div>
  )
}
