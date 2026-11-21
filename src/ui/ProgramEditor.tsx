import { useEffect, useMemo, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { Exercise, ExercisePlan, LibraryExercise, Program, Workout } from '../types'
import { workoutEstimate } from '../domain/dashboard'
import { newPlan, validateProgram } from '../domain/programs'
import type { ProgramFault } from '../domain/programs'
import { swapAlternatives } from '../domain/alternatives'
import { exerciseFamily, familyImpact, type FamilyImpact } from '../domain/programVolume'
import { bodyweightOf } from '../domain/bodyweight'
import { WEIGHT_STEPS } from '../domain/dial'
import { loadText } from '../domain/setText'
import { ExercisePicker } from './ExercisePicker'
import { Sheet } from './Sheet'
import { Select, Switch } from './controls'
import { Icon } from './icons'
import { Stepper } from './Stepper'
import { moveTo } from './program/listMoves'
import { FAMILY_LABELS, planRowText, setsRepsText, wholeCount, workoutSizeText } from './program/planText'
import './ProgramEditor.css'

/**
 * How each Exercise's weight counts (V1-16), stored apart from any Program and read by the live
 * Session: its weight step and its Bodyweight override, both by Exercise id.
 */
export type ExerciseSettings = {
  weightSteps: Record<string, number>
  bodyweight: Record<string, boolean>
}

export type ProgramEditorProps = {
  initial: Program
  isNew: boolean
  resolve: (id: string) => Exercise | undefined
  library: LibraryExercise[]
  gymEquipment: string[] | null
  /**
   * Called with the edited Program, and -- only when a row's options changed one -- the
   * Exercise settings chosen here (V1-16): each changed weight step, and each changed Bodyweight
   * value, by Exercise id.
   */
  onSave(p: Program, settings?: ExerciseSettings): void
  /**
   * The stored Exercise settings (V1-16): every weight step, and every Bodyweight override. Given,
   * a row's options offer "Bodyweight exercise" and "Weight step" for its Exercise.
   */
  exerciseSettings?: ExerciseSettings
  onCancel(): void
  /** When set, shown under the editor's bar. */
  saveError?: string | null
  /**
   * V5-10: the load a Plan is on now (`62.5`), as the Program tab reads it, for an Exercise the
   * trainee has lifted; `null` when it has no history. Given one, a Plan with no starting weight
   * of its own shows it read-only ("Now 47.5") where the grey start weight was, and keeps the
   * Starting weight field in its options.
   */
  nowLoad?(exerciseId: string, plan: ExercisePlan): string | null
  /**
   * N2: a Plan's load cell exactly as the Program tab writes it ("47.5 → 62.5", "BW+5", "–").
   * Given, every Plan row shows the same figure the Program tab shows; omitted, the starting weight.
   */
  loadOf?(plan: ExercisePlan): string
  /** N2: a Workout's minutes from the one estimate Train and the Program tab use; omitted, the plan estimate. */
  minutesOf?(workout: Workout): number
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

/** The fields of a Plan row that count as a change when they differ from where they started. */
const PLAN_FIELDS = ['exerciseId', 'sets', 'minReps', 'maxReps', 'rest', 'startWeight', 'amrapLast'] as const

/**
 * How many edits `now` holds over `start` (V1-09): each changed field, each added or removed
 * Plan or Workout, and each list put in another order count one. A field changed and changed
 * back counts none.
 */
function countChanges(
  start: { name: string; sessions: string; workouts: DraftWorkout[] },
  now: { name: string; sessions: string; workouts: DraftWorkout[] },
): number {
  let count = 0
  if (start.name !== now.name) count += 1
  if (start.sessions !== now.sessions) count += 1
  const startShown = start.workouts.filter((w) => !w.hidden)
  const nowShown = now.workouts.filter((w) => !w.hidden)
  const before = new Map(startShown.map((w) => [w.id, w] as const))
  const kept = nowShown.filter((w) => before.has(w.id))
  count += nowShown.length - kept.length
  count += startShown.length - kept.length
  const order = (list: { id: string }[]) => list.map((w) => w.id).join(' ')
  if (order(kept) !== order(startShown.filter((w) => kept.some((k) => k.id === w.id)))) count += 1
  for (const workout of nowShown) {
    const was = before.get(workout.id)
    if (!was) continue
    if (was.name !== workout.name) count += 1
    const wasPlans = new Map(was.plans.map((p) => [p.uid, p] as const))
    const keptPlans = workout.plans.filter((p) => wasPlans.has(p.uid))
    count += workout.plans.length - keptPlans.length
    count += was.plans.length - keptPlans.length
    const keptUids = new Set(keptPlans.map((p) => p.uid))
    const wasOrder = was.plans.filter((p) => keptUids.has(p.uid)).map((p) => p.uid).join(' ')
    if (keptPlans.map((p) => p.uid).join(' ') !== wasOrder) count += 1
    for (const plan of keptPlans) {
      const old = wasPlans.get(plan.uid)!
      for (const field of PLAN_FIELDS) if (old[field] !== plan[field]) count += 1
    }
  }
  return count
}

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
    rest: restText(plan.restSeconds),
    startWeight: plan.startWeightKg === undefined ? '' : String(plan.startWeightKg),
    amrapLast: plan.amrapLast === true,
  }
}

function toPlan(draft: DraftPlan): ExercisePlan {
  const plan: ExercisePlan = {
    exerciseId: draft.exerciseId,
    sets: Number(draft.sets),
    repRange: [Number(draft.minReps), Number(draft.maxReps)],
    restSeconds: restSecondsOf(draft.rest),
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
/** V5-10: a rest as the editor shows it, `3:00`, as everywhere else in the app. */
function restText(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/**
 * V5-10: the seconds of a rest typed as `m:ss` (`2:15` is 135), or as plain seconds (`120`), so
 * either way saves the same as before; anything else is NaN, which validation refuses.
 */
function restSecondsOf(text: string): number {
  const trimmed = text.trim()
  const clock = /^(\d+):([0-5]\d)$/.exec(trimmed)
  if (clock) return Number(clock[1]) * 60 + Number(clock[2])
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN
}

function typed(text: string): number {
  const value = Number(text)
  return Number.isFinite(value) ? value : 0
}

/** DX-17: Rest steps by 15 s; a Plan's rest shows on its row only when it is not 1:30. */
const REST_STEP = 15
const DEFAULT_REST = 90

/** A weight rounded off float noise (2.5 + 0.1 steps). */
function roundTo(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * DX-16/17: a Plan row's lifter shorthand: "4 × 8–10 · 47.5 kg", "3 × 8–12 · BW"; the weight is
 * the Plan's own starting weight, else the Exercise's.
 */
function planLine(
  plan: DraftPlan,
  exercise: Exercise | undefined,
  bodyweight: boolean,
  loadOf?: (plan: ExercisePlan) => string,
): string {
  // N2: the Program tab's own figure, so the two screens never disagree.
  if (loadOf && exercise !== undefined) {
    const draft = toPlan(plan)
    return planRowText({ sets: typed(plan.sets), repRange: [typed(plan.minReps), typed(plan.maxReps)] }, loadOf(draft))
  }
  const reps = setsRepsText({ sets: typed(plan.sets), repRange: [typed(plan.minReps), typed(plan.maxReps)] })
  if (bodyweight) return `${reps} · ${loadText({ weightKg: null, loadKg: exercise?.startLoadKg })}`
  const weight = plan.startWeight !== '' ? plan.startWeight : exercise?.startWeight
  return weight === null || weight === undefined ? reps : `${reps} · ${weight} kg`
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
  exerciseSettings,
  nowLoad,
  loadOf,
  minutesOf,
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
  /** DX-17: the Plan whose editor page is pushed over the list. */
  const [editingPlan, setEditingPlan] = useState<{ workoutId: string; uid: string } | null>(null)
  /** DX-17: the Workouts showing ↑/↓ on every row ("Reorder"), and those being renamed. */
  const [reordering, setReordering] = useState<Set<string>>(() => new Set())
  // A Workout with no name yet opens with its name field, and keeps it while it is typed into.
  const [renaming, setRenaming] = useState<Set<string>>(
    () => new Set(initial.workouts.filter((w) => w.name === '').map((w) => w.id)),
  )
  const [lastEdited, setLastEdited] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ workoutId: string; from: number; to: number } | null>(null)
  const [focusUid, setFocusUid] = useState<string | null>(null)
  // The draft as it opened, so Cancel can say how many changes it would throw away (V1-09).
  const [start] = useState(() => ({ name, sessions: sessionsText ?? String(initialVisible), workouts }))
  const [askDiscard, setAskDiscard] = useState(false)
  // V1-16: the Exercise settings changed in this edit, kept apart until Save like every field.
  const [settingEdits, setSettingEdits] = useState<ExerciseSettings>({ weightSteps: {}, bodyweight: {} })
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

  const toggle = (set: (change: (open: Set<string>) => Set<string>) => void, key: string) =>
    set((open) => {
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

  const addWorkout = () => {
    const id = newWorkoutId()
    setWorkouts((all) => [...all, { id, name: '', hidden: false, plans: [] }])
    setRenaming((open) => new Set(open).add(id))
  }

  const closePicker = () => setPicking(null)

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

  /** Whether `exercise` is Bodyweight, as stored or as changed in this edit (V1-16). */
  const storedBodyweight = (exercise: Exercise): boolean =>
    bodyweightOf(exercise, exerciseSettings?.bodyweight ?? {})
  const bodyweightFor = (exercise: Exercise | undefined): boolean =>
    exercise === undefined ? false : settingEdits.bodyweight[exercise.id] ?? storedBodyweight(exercise)
  const storedStep = (exercise: Exercise): number =>
    exerciseSettings?.weightSteps[exercise.id] ?? exercise.weightStep
  const stepFor = (exercise: Exercise): number => settingEdits.weightSteps[exercise.id] ?? storedStep(exercise)

  /** Records a changed Bodyweight value for `exercise`, or drops the edit when it is back as stored. */
  const editBodyweight = (exercise: Exercise, value: boolean) =>
    setSettingEdits((edits) => {
      const bodyweight = { ...edits.bodyweight }
      if (value === storedBodyweight(exercise)) delete bodyweight[exercise.id]
      else bodyweight[exercise.id] = value
      return { ...edits, bodyweight }
    })

  /** Records a changed weight step for `exercise`, or drops the edit when it is back as stored. */
  const editStep = (exercise: Exercise, value: number) =>
    setSettingEdits((edits) => {
      const weightSteps = { ...edits.weightSteps }
      if (value === storedStep(exercise)) delete weightSteps[exercise.id]
      else weightSteps[exercise.id] = value
      return { ...edits, weightSteps }
    })

  const settingChanges =
    Object.keys(settingEdits.weightSteps).length + Object.keys(settingEdits.bodyweight).length
  const save = () => (settingChanges > 0 ? onSave(draftProgram, settingEdits) : onSave(draftProgram))

  const changes = countChanges(start, { name, sessions: sessionsShown, workouts }) + settingChanges
  const cancel = () => {
    if (changes === 0) onCancel()
    else setAskDiscard(true)
  }
  const discardTitle = `Discard ${changes} ${changes === 1 ? 'change' : 'changes'}?`

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

  const matchingTitle = (): string => {
    if (picking === null) return ''
    const workout = workouts.find((w) => w.id === picking.workoutId)
    if (picking.swapUid !== null) {
      const plan = workout?.plans.find((p) => p.uid === picking.swapUid)
      return `Swap ${plan ? resolve(plan.exerciseId)?.name ?? plan.exerciseId : 'exercise'}`
    }
    const shown = visible.findIndex((w) => w.id === picking.workoutId)
    return `Add to ${workout && workout.name !== '' ? workout.name : `Workout ${shown + 1}`}`
  }

  /** DX-08: a swap leads with the planned Exercise's ranked stand-ins under "Similar". */
  const similarFor = (): LibraryExercise[] | undefined => {
    if (picking === null || picking.swapUid === null) return undefined
    const plan = workouts.find((w) => w.id === picking.workoutId)?.plans.find((p) => p.uid === picking.swapUid)
    const target = plan ? libraryById.get(resolve(plan.exerciseId)?.libraryId ?? plan.exerciseId) : undefined
    return target ? swapAlternatives(target, libraryById, null).slice(0, 6) : undefined
  }

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

  const picker =
    picking === null ? null : (
      <ExercisePicker
        title={matchingTitle()}
        library={library}
        taken={workouts.find((w) => w.id === picking.workoutId)?.plans.map((p) => p.exerciseId) ?? []}
        similar={similarFor()}
        gymEquipment={gymEquipment}
        onPick={pick}
        onClose={closePicker}
      />
    )

  // DX-17: a tapped Plan row pushes its Plan editor in place of the list.
  const planOpen = (() => {
    if (editingPlan === null) return null
    const workout = workouts.find((w) => w.id === editingPlan.workoutId)
    const index = workout?.plans.findIndex((p) => p.uid === editingPlan.uid) ?? -1
    if (!workout || index < 0) return null
    const fullIndex = workouts.indexOf(workout)
    return { workout, index, plan: workout.plans[index], path: `workouts.${fullIndex}.exercises.${index}` }
  })()

  if (planOpen !== null) {
    const { workout, index, plan, path } = planOpen
    const exercise = resolve(plan.exerciseId)
    const exerciseName = exercise?.name ?? plan.exerciseId
    const bodyweight = bodyweightFor(exercise)
    const step = exercise ? stepFor(exercise) : 2.5
    const nowText =
      nowLoad === undefined || plan.startWeight !== '' || exercise === undefined || bodyweight
        ? null
        : nowLoad(plan.exerciseId, toPlan(plan))
    const set = (change: Partial<DraftPlan>) => {
      updatePlan(workout.id, index, change)
      setLastEdited(plan.uid)
    }
    const sets = typed(plan.sets)
    const min = typed(plan.minReps)
    const max = typed(plan.maxReps)
    const rest = restSecondsOf(plan.rest)
    const restNow = Number.isNaN(rest) ? 90 : rest
    const start = plan.startWeight === '' ? null : typed(plan.startWeight)
    const startShown = start ?? exercise?.startWeight ?? 0
    const fault = (field: string) => faultMessage(faults, `${path}.${field}`)
    const faultLine = (field: string) =>
      fault(field) ? (
        <p id={faultId(`${path}.${field}`)} className="program-editor-fault">
          {fault(field)}
        </p>
      ) : null
    return (
      <div className="program-editor plan-editor">
        <div className="program-editor-bar">
          {/* N7: the bare ‹ every pushed page wears. */}
          <button
            type="button"
            className="program-editor-back icon-btn"
            aria-label="Back"
            onClick={() => setEditingPlan(null)}
          >
            <Icon name="ChevronLeft" size={24} />
          </button>
          <h1 className="program-editor-title">{exerciseName}</h1>
          <span aria-hidden="true" />
        </div>

        <div className="plan-editor-rows">
          <div className="plan-editor-row">
            <span className="plan-editor-label">Sets</span>
            <Stepper
              label="Sets"
              value={String(sets)}
              canDecrease={sets > 1}
              canIncrease={sets < 20}
              describedBy={fault('sets') ? faultId(`${path}.sets`) : undefined}
              onDecrease={() => set({ sets: String(sets - 1) })}
              onIncrease={() => set({ sets: String(sets + 1) })}
            />
          </div>
          {faultLine('sets')}
          <div className="plan-editor-row">
            <span className="plan-editor-label">Min reps</span>
            <Stepper
              label="Min reps"
              value={String(min)}
              canDecrease={min > 1}
              canIncrease={min < max}
              describedBy={fault('repRange') ? faultId(`${path}.repRange`) : undefined}
              onDecrease={() => set({ minReps: String(min - 1) })}
              onIncrease={() => set({ minReps: String(min + 1) })}
            />
          </div>
          <div className="plan-editor-row">
            <span className="plan-editor-label">Max reps</span>
            <Stepper
              label="Max reps"
              value={String(max)}
              canDecrease={max > min}
              canIncrease={max < 100}
              describedBy={fault('repRange') ? faultId(`${path}.repRange`) : undefined}
              onDecrease={() => set({ maxReps: String(max - 1) })}
              onIncrease={() => set({ maxReps: String(max + 1) })}
            />
          </div>
          {faultLine('repRange')}
          <div className="plan-editor-row">
            <span className="plan-editor-label">Rest</span>
            <Stepper
              label="Rest"
              value={restText(restNow)}
              canDecrease={restNow > 0}
              canIncrease={restNow < 600}
              describedBy={fault('restSeconds') ? faultId(`${path}.restSeconds`) : undefined}
              onDecrease={() => set({ rest: restText(Math.max(0, restNow - REST_STEP)) })}
              onIncrease={() => set({ rest: restText(restNow + REST_STEP) })}
            />
          </div>
          {faultLine('restSeconds')}
          {exerciseSettings === undefined || exercise === undefined || bodyweight ? null : (
            // V1-16: how this Exercise's weight counts, wherever it is planned or logged.
            <label className="plan-editor-row">
              <span className="plan-editor-label">Weight step</span>
              <Select
                aria-label={`${exerciseName} weight step`}
                value={stepFor(exercise)}
                onChange={(event) => editStep(exercise, Number(event.target.value))}
              >
                {WEIGHT_STEPS.map((option) => (
                  <option key={option} value={option}>
                    {`${option} kg`}
                  </option>
                ))}
              </Select>
            </label>
          )}
          {bodyweight ? (
            <div className="plan-editor-row">
              <span className="plan-editor-label">Load</span>
              <span className="plan-editor-value">{loadText({ weightKg: null, loadKg: exercise?.startLoadKg })}</span>
            </div>
          ) : (
            <div className="plan-editor-row">
              <span className="plan-editor-label">
                Starting weight
                {nowText !== null ? <span className="plan-editor-hint">{`Now ${nowText} kg`}</span> : null}
                {start === null && nowText === null ? <span className="plan-editor-hint">Exercise default</span> : null}
              </span>
              <Stepper
                label="Starting weight"
                value={`${startShown} kg`}
                canDecrease={startShown - step >= 0}
                describedBy={fault('startWeightKg') ? faultId(`${path}.startWeightKg`) : undefined}
                onDecrease={() => set({ startWeight: String(roundTo(startShown - step)) })}
                onIncrease={() => set({ startWeight: String(roundTo(startShown + step)) })}
              />
            </div>
          )}
          {faultLine('startWeightKg')}
          <div className="plan-editor-row plan-editor-switch">
            <Switch checked={plan.amrapLast} onChange={(next) => set({ amrapLast: next })} label="Last set AMRAP" />
          </div>
          {exerciseSettings === undefined || exercise === undefined ? null : (
            <div className="plan-editor-row plan-editor-switch">
              <Switch
                checked={bodyweight}
                onChange={(next) => editBodyweight(exercise, next)}
                label="Bodyweight exercise"
              />
            </div>
          )}
          {exerciseSettings === undefined || exercise === undefined ? null : (
            <p className="plan-editor-note">{`Weight step and Bodyweight apply to ${exerciseName} in every workout.`}</p>
          )}
          <button
            type="button"
            className="plan-editor-row plan-editor-swap cell"
            onClick={() => setPicking({ workoutId: workout.id, swapUid: plan.uid })}
          >
            <span className="plan-editor-label">Swap exercise</span>
            <Icon name="ChevronRight" size={18} />
          </button>
        </div>

        <button
          type="button"
          className="plan-editor-remove btn-danger"
          onClick={() => {
            updateWorkout(workout.id, (w) => ({ ...w, plans: w.plans.filter((p) => p.uid !== plan.uid) }))
            setLastEdited(null)
            setEditingPlan(null)
          }}
        >
          Remove from Workout
        </button>
        {picker}
      </div>
    )
  }

  return (
    <div className={impact ? 'program-editor program-editor-with-impact' : 'program-editor'}>
      <div className="program-editor-bar">
        <button type="button" className="program-editor-cancel btn-quiet" onClick={cancel}>
          Cancel
        </button>
        <h1 className="program-editor-title">{title ?? (isNew ? 'New program' : `Edit ${initial.name}`)}</h1>
        <button type="button" className="program-editor-save btn-quiet" onClick={save} disabled={!canSave}>
          Save
        </button>
      </div>

      {askDiscard ? (
        <Sheet label={discardTitle} onClose={() => setAskDiscard(false)}>
          <div className="sheet-head">
            <h2 className="sheet-title">{discardTitle}</h2>
          </div>
          <div className="program-editor-discard">
            <button type="button" className="btn-danger" onClick={onCancel}>
              Discard
            </button>
            <button type="button" className="btn-secondary" onClick={() => setAskDiscard(false)}>
              Keep editing
            </button>
          </div>
        </Sheet>
      ) : null}

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
        <div className="program-editor-field program-editor-field-row">
          <span className="program-editor-label">Sessions per week</span>
          <Stepper
            label="Sessions per week"
            value={sessionsShown}
            canDecrease={typed(sessionsShown) > 1}
            canIncrease={typed(sessionsShown) < 7}
            describedBy={faultMessage(faults, 'sessionsPerWeek') ? faultId('sessionsPerWeek') : undefined}
            onDecrease={() => setSessionsText(String(Math.max(1, typed(sessionsShown) - 1)))}
            onIncrease={() => setSessionsText(String(Math.min(7, typed(sessionsShown) + 1)))}
          />
        </div>
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
        const asWorkout: Workout = {
          id: workout.id,
          name: workout.name,
          exercises: workout.plans.map((p) => ({
            exerciseId: p.exerciseId,
            sets: typed(p.sets),
            repRange: [typed(p.minReps), typed(p.maxReps)],
            restSeconds: typed(String(restSecondsOf(p.rest))),
          })),
        }
        const estimate = workoutEstimate(asWorkout)
        const minutes = minutesOf?.(asWorkout) ?? estimate.minutes
        const label = workout.name === '' ? `Workout ${displayIndex + 1}` : workout.name
        const naming = renaming.has(workout.id) || nameFault !== undefined
        const ordering = reordering.has(workout.id)
        return (
        <section key={workout.id} className="program-editor-workout" aria-label={label}>
          <div className="program-editor-workout-head">
            {naming ? (
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
            ) : (
              <h3 className="program-editor-workout-title">{label}</h3>
            )}
            <span className="program-editor-workout-size">{workoutSizeText(estimate.sets, minutes)}</span>
          </div>
          <div className="program-editor-workout-actions" role="group" aria-label={`${label} actions`}>
            <button
              type="button"
              className="program-editor-text btn-quiet"
              aria-pressed={ordering}
              onClick={() => toggle(setReordering, workout.id)}
            >
              {ordering ? 'Done' : 'Reorder'}
            </button>
            <button
              type="button"
              className="program-editor-text btn-quiet"
              aria-pressed={naming}
              onClick={() => toggle(setRenaming, workout.id)}
            >
              Rename
            </button>
            {ordering && visible.length > 1 ? (
              <>
                <button
                  type="button"
                  className="program-editor-text btn-quiet"
                  aria-label={`Move ${label} up`}
                  disabled={displayIndex === 0}
                  onClick={() => moveWorkout(workout.id, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="program-editor-text btn-quiet"
                  aria-label={`Move ${label} down`}
                  disabled={displayIndex === visible.length - 1}
                  onClick={() => moveWorkout(workout.id, 1)}
                >
                  ↓
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="program-editor-text program-editor-remove-workout btn-danger"
              aria-label={`Remove ${label}`}
              onClick={() => removeWorkout(workout.id)}
            >
              Remove
            </button>
          </div>
          {nameFault && (
            <p id={faultId(`${workoutPath}.name`)} className="program-editor-fault">
              {nameFault}
            </p>
          )}

          <ol className="program-editor-plans">
            {workout.plans.map((plan, j) => {
              const exercise = resolve(plan.exerciseId)
              const exerciseName = exercise?.name ?? plan.exerciseId
              const isDropTarget = drag !== null && drag.workoutId === workout.id && drag.to === j && drag.from !== j
              const planPath = `${workoutPath}.exercises.${j}`
              const planFault = faults.find((f) => f.path.startsWith(`${planPath}.`))
              const line = planLine(plan, exercise, bodyweightFor(exercise), loadOf)
              const restNote = restSecondsOf(plan.rest) !== DEFAULT_REST ? ` · ${plan.rest} rest` : ''
              return (
                <li
                  key={plan.uid}
                  className="program-editor-plan"
                  data-dragging={drag !== null && drag.workoutId === workout.id && drag.from === j ? 'true' : undefined}
                  data-drop-target={isDropTarget ? 'true' : undefined}
                >
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
                  <button
                    type="button"
                    className="program-editor-plan-row cell"
                    aria-label={`${exerciseName}, ${line}${restNote}`}
                    onClick={() => setEditingPlan({ workoutId: workout.id, uid: plan.uid })}
                  >
                    <span className="program-editor-plan-name">{exerciseName}</span>
                    <span className="program-editor-plan-line">
                      {line}
                      {restNote === '' ? null : <span className="program-editor-plan-rest">{restNote}</span>}
                    </span>
                    {planFault ? <span className="program-editor-plan-fault">{planFault.message}</span> : null}
                  </button>
                  {ordering ? (
                    <span className="program-editor-arrows">
                      <button
                        type="button"
                        className="program-editor-arrow btn-quiet"
                        aria-label={`Move ${exerciseName} up`}
                        disabled={j === 0}
                        onClick={() => movePlan(workout.id, j, j - 1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="program-editor-arrow btn-quiet"
                        aria-label={`Move ${exerciseName} down`}
                        disabled={j === workout.plans.length - 1}
                        onClick={() => movePlan(workout.id, j, j + 1)}
                      >
                        ↓
                      </button>
                    </span>
                  ) : null}
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
        </section>
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
            {`${FAMILY_LABELS[impact.headline.family]} ${wholeCount(impact.headline.before)} → ${wholeCount(impact.headline.after)} sets/week`}
          </p>
          <ImpactBars impact={impact.headline} />
        </aside>
      )}

      {picker}
    </div>
  )
}

/** The impact card's Before / After bars on a 0 to `axisTop` scale, ticked at its ends and middle. */
function ImpactBars({ impact }: { impact: FamilyImpact }): JSX.Element {
  const top = axisTop(impact)
  const bars = [
    { label: 'Before', value: impact.before, after: false },
    { label: 'After', value: impact.after, after: true },
  ]
  return (
    <div className="program-editor-impact-chart">
      {bars.map((bar) => (
        <div key={bar.label} className="program-editor-impact-row">
          <span className="program-editor-impact-bar-label">{bar.label}</span>
          <span className="program-editor-impact-track">
            <span
              className={bar.after ? 'program-editor-impact-bar program-editor-impact-bar-after' : 'program-editor-impact-bar'}
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
