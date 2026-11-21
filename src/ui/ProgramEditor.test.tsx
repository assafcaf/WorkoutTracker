// E9-T7 / DX-17: the Program editor. A Program's name and Workouts are on one list: each Workout
// a `<section>` headed by its name, with Reorder · Rename · Remove text buttons, and one row button
// per Plan ("Back Squat, 3 × 8–10 · 60 kg"). A tap on a row pushes that Plan's editor: steppers for
// Sets, reps, Rest and Starting weight, Last set AMRAP, Swap exercise and Remove from Workout.
// Rendered outside a Shell, `useActionBarSlot()` is null, so `Save` renders in place.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { Mock } from 'vitest'
import { ProgramEditor } from './ProgramEditor'
import type { ProgramEditorProps } from './ProgramEditor'
import type { Exercise, ExercisePlan, LibraryExercise, Program } from '../types'

// --- fixtures -----------------------------------------------------------------------------------

function exercise(overrides: Partial<Exercise> & { id: string; name: string }): Exercise {
  return {
    weightStep: 2.5,
    startWeight: 20,
    bodyweight: false,
    libraryId: overrides.id,
    ...overrides,
  }
}

function libraryEntry(
  overrides: Partial<LibraryExercise> & { id: string; name: string },
): LibraryExercise {
  return {
    force: null,
    level: 'beginner',
    mechanic: null,
    equipment: 'barbell',
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    instructions: [],
    category: 'strength',
    images: [],
    ...overrides,
  }
}

// Names chosen so none is a substring of another: a Plan's row is told apart by its text.
const exercises: Exercise[] = [
  exercise({ id: 'bench', name: 'Flat Bench', startWeight: 40 }),
  exercise({ id: 'squat', name: 'Back Squat', startWeight: 60 }),
  exercise({ id: 'row', name: 'Cable Row', startWeight: 30 }),
  exercise({ id: 'press', name: 'Overhead Press', startWeight: 25 }),
  exercise({ id: 'dips', name: 'Parallel Dips', startWeight: null, bodyweight: true }),
  exercise({ id: 'Dumbbell_Incline_Fly', name: 'Dumbbell Incline Fly', startWeight: 12.5 }),
  exercise({ id: 'Barbell_Deadlift', name: 'Barbell Deadlift', startWeight: 0 }),
  exercise({ id: 'Pushups', name: 'Pushups', startWeight: null, bodyweight: true }),
]
const byId = new Map(exercises.map((e) => [e.id, e] as const))
const resolve = (id: string) => byId.get(id)

const library: LibraryExercise[] = [
  libraryEntry({ id: 'Dumbbell_Incline_Fly', name: 'Dumbbell Incline Fly', equipment: 'dumbbell' }),
  libraryEntry({ id: 'Barbell_Deadlift', name: 'Barbell Deadlift', primaryMuscles: ['lower back'] }),
  libraryEntry({ id: 'Pushups', name: 'Pushups', equipment: 'body only' }),
]

const NAMES = exercises.map((e) => e.name)

const benchPlan: ExercisePlan = {
  exerciseId: 'bench',
  sets: 4,
  repRange: [6, 8],
  restSeconds: 120,
  startWeightKg: 60,
}
const squatPlan: ExercisePlan = { exerciseId: 'squat', sets: 3, repRange: [8, 10], restSeconds: 90 }
const rowPlan: ExercisePlan = { exerciseId: 'row', sets: 2, repRange: [10, 12], restSeconds: 60 }
const pressPlan: ExercisePlan = { exerciseId: 'press', sets: 5, repRange: [5, 5], restSeconds: 180 }

/** Two Workouts, three Plans in the first. */
function split(): Program {
  return {
    id: 'split',
    name: 'Split',
    units: 'kg',
    sessionsPerWeek: 2,
    workouts: [
      { id: 'wa', name: 'Upper', exercises: [{ ...benchPlan }, { ...squatPlan }, { ...rowPlan }] },
      { id: 'wb', name: 'Lower', exercises: [{ ...pressPlan }] },
    ],
  }
}

function blank(): Program {
  return { id: 'user-new', name: '', units: 'kg', sessionsPerWeek: 1, workouts: [] }
}


// --- helpers ------------------------------------------------------------------------------------

type User = ReturnType<typeof userEvent.setup>

function renderEditor(initial: Program, overrides: Partial<ProgramEditorProps> = {}) {
  const onSave: Mock<(p: Program) => void> = vi.fn()
  const onCancel: Mock<() => void> = vi.fn()
  const user = userEvent.setup()
  render(
    <ProgramEditor
      initial={initial}
      isNew={false}
      resolve={resolve}
      library={library}
      gymEquipment={null}
      onSave={onSave}
      onCancel={onCancel}
      {...overrides}
    />,
  )
  return { onSave, onCancel, user }
}

async function save(user: User, onSave: Mock<(p: Program) => void>): Promise<Program> {
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(onSave).toHaveBeenCalledTimes(1)
  return onSave.mock.calls[0][0]
}

function workoutNameInputs(): HTMLInputElement[] {
  return screen.queryAllByLabelText('Workout name') as HTMLInputElement[]
}

/** The visible Workouts, top to bottom: each a `<section>` named after its Workout. */
function workouts(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('section.program-editor-workout'))
}

function workoutAt(index: number): HTMLElement {
  const all = workouts()
  expect(all.length, 'visible Workouts').toBeGreaterThan(index)
  return all[index]
}

/** Each visible Workout's name: its heading, or its name field while it is named. */
function workoutNamesShown(): string[] {
  return workouts().map((section) => {
    const input = section.querySelector('input')
    return input ? input.value : section.querySelector('h3')?.textContent ?? ''
  })
}

/** A Workout's Plans, top to bottom. */
function plans(workout: HTMLElement): HTMLElement[] {
  return within(workout).queryAllByRole('listitem')
}

function planNamesShown(workout: HTMLElement): string[] {
  return plans(workout).map(
    (item) => NAMES.find((name) => (item.textContent ?? '').includes(name)) ?? '(unnamed)',
  )
}

function planRow(workout: HTMLElement, name: string): HTMLElement {
  return within(workout).getByRole('button', { name: new RegExp(`^${name}, `) })
}

/** DX-17: a tap on a Plan row pushes its Plan editor. */
async function openPlan(user: User, workout: HTMLElement, name: string): Promise<void> {
  await user.click(planRow(workout, name))
  expect(screen.getByRole('heading', { level: 1, name })).toBeInTheDocument()
}

/** A stepper's value as shown ("4", "1:30", "60 kg"). */
function stepped(label: string): string {
  return screen.getByRole('group', { name: label }).querySelector('output')?.textContent ?? ''
}

async function back(user: User): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Back' }))
}

async function pickInto(user: User, workout: HTMLElement, query: string, name: string): Promise<void> {
  await user.click(within(workout).getByRole('button', { name: 'Add exercise' }))
  await user.type(screen.getByLabelText('Search exercises'), query)
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name }))
}

function sessionsPerWeek(): string {
  return stepped('Sessions per week')
}

async function reorder(user: User, workout: HTMLElement): Promise<void> {
  await user.click(within(workout).getByRole('button', { name: 'Reorder' }))
}

// --- O14: a new Plan's defaults, and Sessions per week ------------------------------------------

test('O14 DX-17 a Plan added through Add exercise, search and a row tap reads 3 × 8–12, with 1:30 rest in its editor', async () => {
  const { user } = renderEditor(split())

  await pickInto(user, workoutAt(1), 'fly', 'Dumbbell Incline Fly')

  expect(planRow(workoutAt(1), 'Dumbbell Incline Fly')).toHaveAccessibleName(
    'Dumbbell Incline Fly, 3 × 8–12 · 12.5 kg',
  )
  await openPlan(user, workoutAt(1), 'Dumbbell Incline Fly')
  expect(stepped('Sets')).toBe('3')
  expect(stepped('Min reps')).toBe('8')
  expect(stepped('Max reps')).toBe('12')
  expect(stepped('Rest')).toBe('1:30')
})

test('O14 a picked Plan is added last in its Workout and saved with the default numbers', async () => {
  const { user, onSave } = renderEditor(split())

  await pickInto(user, workoutAt(1), 'fly', 'Dumbbell Incline Fly')
  expect(planNamesShown(workoutAt(1))).toEqual(['Overhead Press', 'Dumbbell Incline Fly'])

  const program = await save(user, onSave)
  expect(program.workouts[1].exercises).toEqual([
    pressPlan,
    { exerciseId: 'Dumbbell_Incline_Fly', sets: 3, repRange: [8, 12], restSeconds: 90 },
  ])
})

test("O14 DX-17 a Plan with no starting weight of its own shows its Exercise's, marked Exercise default", async () => {
  const { user } = renderEditor(split())

  await openPlan(user, workoutAt(0), 'Back Squat')

  expect(stepped('Starting weight')).toBe('60 kg')
  expect(screen.getByText('Exercise default')).toBeInTheDocument()
})

test('O14 DX-17 a Plan with a starting weight shows it on its row and in its editor', async () => {
  const { user } = renderEditor(split())

  expect(planRow(workoutAt(0), 'Flat Bench')).toHaveAccessibleName('Flat Bench, 4 × 6–8 · 60 kg · 2:00 rest')
  await openPlan(user, workoutAt(0), 'Flat Bench')
  expect(stepped('Starting weight')).toBe('60 kg')
  expect(screen.queryByText('Exercise default')).toBeNull()
})

test('O14 DX-17 stepping a picked Plan\'s Starting weight saves it as its startWeightKg', async () => {
  const { user, onSave } = renderEditor(split())

  await pickInto(user, workoutAt(1), 'fly', 'Dumbbell Incline Fly')
  await openPlan(user, workoutAt(1), 'Dumbbell Incline Fly')
  await user.click(screen.getByRole('button', { name: 'Increase Starting weight' }))
  expect(stepped('Starting weight')).toBe('15 kg')
  await back(user)

  const program = await save(user, onSave)
  expect(program.workouts[1].exercises[1]).toEqual({
    exerciseId: 'Dumbbell_Incline_Fly',
    sets: 3,
    repRange: [8, 12],
    restSeconds: 90,
    startWeightKg: 15,
  })
})

test('O14 the exercise search lists only library Exercises whose name matches, case-insensitively', async () => {
  const { user } = renderEditor(split())

  await user.click(within(workoutAt(0)).getByRole('button', { name: 'Add exercise' }))
  await user.type(screen.getByLabelText('Search exercises'), 'BARBELL')

  const picker = screen.getByRole('dialog')
  expect(within(picker).getByRole('button', { name: 'Barbell Deadlift' })).toBeInTheDocument()
  expect(within(picker).queryByRole('button', { name: 'Dumbbell Incline Fly' })).toBeNull()
})

test('DX-08 the picker is titled after the Workout it adds to', async () => {
  const { user } = renderEditor(split())

  await user.click(within(workoutAt(1)).getByRole('button', { name: 'Add exercise' }))

  expect(screen.getByRole('dialog', { name: 'Add to Lower' })).toBeInTheDocument()
})

test('O14 a pick closes the exercise search', async () => {
  const { user } = renderEditor(split())

  await pickInto(user, workoutAt(0), 'push', 'Pushups')

  expect(screen.queryByLabelText('Search exercises')).toBeNull()
})

test('O14 Sessions per week follows the number of Workouts as they are added and removed', async () => {
  const { user, onSave } = renderEditor(blank(), { isNew: true })

  await user.click(screen.getByRole('button', { name: 'Add workout' }))
  expect(sessionsPerWeek()).toBe('1')
  await user.click(screen.getByRole('button', { name: 'Add workout' }))
  expect(sessionsPerWeek()).toBe('2')
  await user.click(screen.getByRole('button', { name: 'Add workout' }))
  expect(sessionsPerWeek()).toBe('3')
  await user.click(within(workoutAt(2)).getByRole('button', { name: 'Remove Workout 3' }))
  expect(sessionsPerWeek()).toBe('2')

  await user.type(screen.getByLabelText('Program name'), 'New Program')
  await user.type(workoutNameInputs()[0], 'First')
  await user.type(workoutNameInputs()[1], 'Second')
  await pickInto(user, workoutAt(0), 'push', 'Pushups')
  await pickInto(user, workoutAt(1), 'fly', 'Dumbbell Incline Fly')

  const program = await save(user, onSave)
  expect(program.sessionsPerWeek).toBe(2)
})

test('O14 DX-17 Sessions per week is a 1–7 stepper, and stops following the Workouts once stepped', async () => {
  const { user, onSave } = renderEditor(blank(), { isNew: true })

  await user.click(screen.getByRole('button', { name: 'Add workout' }))
  await user.click(screen.getByRole('button', { name: 'Add workout' }))
  await user.click(screen.getByRole('button', { name: 'Increase Sessions per week' }))
  await user.click(screen.getByRole('button', { name: 'Increase Sessions per week' }))
  expect(sessionsPerWeek()).toBe('4')
  await user.click(screen.getByRole('button', { name: 'Add workout' }))
  expect(sessionsPerWeek()).toBe('4')
  await user.click(within(workoutAt(0)).getByRole('button', { name: 'Remove Workout 1' }))
  expect(sessionsPerWeek()).toBe('4')

  await user.type(screen.getByLabelText('Program name'), 'New Program')
  await user.type(workoutNameInputs()[0], 'First')
  await user.type(workoutNameInputs()[1], 'Second')
  await pickInto(user, workoutAt(0), 'push', 'Pushups')
  await pickInto(user, workoutAt(1), 'fly', 'Dumbbell Incline Fly')

  const program = await save(user, onSave)
  expect(program.sessionsPerWeek).toBe(4)
})

test('DX-17 Sessions per week cannot step below 1 or above 7', async () => {
  const { user } = renderEditor({ ...split(), sessionsPerWeek: 7 })

  expect(screen.getByRole('button', { name: 'Increase Sessions per week' })).toBeDisabled()
  for (let i = 0; i < 6; i += 1) {
    await user.click(screen.getByRole('button', { name: 'Decrease Sessions per week' }))
  }
  expect(sessionsPerWeek()).toBe('1')
  expect(screen.getByRole('button', { name: 'Decrease Sessions per week' })).toBeDisabled()
})

test('O14 Sessions per week counts only the visible Workouts, not hidden ones', async () => {
  const initial = split()
  initial.workouts.push({ id: 'wc', name: 'Retired', exercises: [{ ...rowPlan }], hidden: true })
  const { user, onSave } = renderEditor(initial)

  expect(sessionsPerWeek()).toBe('2')
  await user.click(screen.getByRole('button', { name: 'Add workout' }))
  expect(sessionsPerWeek()).toBe('3')

  await user.type(workoutNameInputs()[0], 'Extra')
  await pickInto(user, workoutAt(2), 'push', 'Pushups')

  const program = await save(user, onSave)
  expect(program.sessionsPerWeek).toBe(3)
})

// --- DX-17: a Workout is a heading with text buttons; a Plan is one row -------------------------

test('DX-17 a Workout reads as a heading with its size and Reorder · Rename · Remove, no "..." menu', () => {
  renderEditor(split())

  const upper = workoutAt(0)
  expect(within(upper).getByRole('heading', { level: 3, name: 'Upper' })).toBeInTheDocument()
  expect(within(upper).getByText(/^9 sets · ~\d+ min$/)).toBeInTheDocument()
  const actions = within(upper).getByRole('group', { name: 'Upper actions' })
  expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual([
    'Reorder',
    'Rename',
    'Remove',
  ])
  expect(screen.queryByRole('button', { name: /^Options for / })).toBeNull()
})

test('DX-17 the main list shows no number fields: each Plan is one row button with its shorthand', () => {
  renderEditor(split())

  expect(screen.queryAllByRole('spinbutton')).toHaveLength(0)
  const upper = workoutAt(0)
  expect(plans(upper)).toHaveLength(3)
  expect(planRow(upper, 'Back Squat')).toHaveAccessibleName('Back Squat, 3 × 8–10 · 60 kg')
  expect(planRow(upper, 'Cable Row')).toHaveAccessibleName('Cable Row, 2 × 10–12 · 30 kg · 1:00 rest')
})

test('DX-17 Rename swaps the heading for a name field; the typed name is saved', async () => {
  const { user, onSave } = renderEditor(split())

  await user.click(within(workoutAt(0)).getByRole('button', { name: 'Rename' }))
  const nameField = within(workoutAt(0)).getByLabelText('Workout name')
  await user.clear(nameField)
  await user.type(nameField, 'Push')

  expect(workoutNamesShown()).toEqual(['Push', 'Lower'])
  const program = await save(user, onSave)
  expect(program.workouts[0].name).toBe('Push')
})

// --- O15: rearranging, removing, Cancel ---------------------------------------------------------

test('O15 DX-17 Reorder shows Move down on the first Workout; it puts it second, shown and saved', async () => {
  const { user, onSave } = renderEditor(split())

  expect(screen.queryByRole('button', { name: 'Move Upper down' })).toBeNull()
  await reorder(user, workoutAt(0))
  await user.click(screen.getByRole('button', { name: 'Move Upper down' }))

  expect(workoutNamesShown()).toEqual(['Lower', 'Upper'])
  const program = await save(user, onSave)
  expect(program.workouts.map((w) => w.id)).toEqual(['wb', 'wa'])
  expect(program.workouts[1].exercises).toEqual([benchPlan, squatPlan, rowPlan])
})

test('O15 Move up on the second Workout puts it first, shown and saved', async () => {
  const { user, onSave } = renderEditor(split())

  await reorder(user, workoutAt(1))
  await user.click(screen.getByRole('button', { name: 'Move Lower up' }))

  expect(workoutNamesShown()).toEqual(['Lower', 'Upper'])
  const program = await save(user, onSave)
  expect(program.workouts.map((w) => w.id)).toEqual(['wb', 'wa'])
})

test('O15 DX-17 in Reorder, Move up on a Plan swaps it with the one above, its numbers kept', async () => {
  const { user, onSave } = renderEditor(split())

  await reorder(user, workoutAt(0))
  expect(within(workoutAt(0)).getByRole('button', { name: 'Done' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(screen.getByRole('button', { name: 'Move Back Squat up' }))

  expect(planNamesShown(workoutAt(0))).toEqual(['Back Squat', 'Flat Bench', 'Cable Row'])
  const program = await save(user, onSave)
  expect(program.workouts[0].exercises).toEqual([squatPlan, benchPlan, rowPlan])
})

test('O15 Move down on a Plan swaps it with the one below, shown and saved', async () => {
  const { user, onSave } = renderEditor(split())

  await reorder(user, workoutAt(0))
  await user.click(screen.getByRole('button', { name: 'Move Back Squat down' }))

  expect(planNamesShown(workoutAt(0))).toEqual(['Flat Bench', 'Cable Row', 'Back Squat'])
  const program = await save(user, onSave)
  expect(program.workouts[0].exercises).toEqual([benchPlan, rowPlan, squatPlan])
})

test("O15 Move up on a Workout's first Plan and Move down on its last are disabled", async () => {
  const { user } = renderEditor(split())

  await reorder(user, workoutAt(0))
  expect(screen.getByRole('button', { name: 'Move Flat Bench up' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Move Flat Bench down' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Move Cable Row down' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Move Upper up' })).toBeDisabled()

  await user.click(within(workoutAt(0)).getByRole('button', { name: 'Done' }))
  expect(screen.queryByRole('button', { name: /^Move / })).toBeNull()
})

test('O15 DX-17 Remove from Workout on the Plan editor drops the Plan, shown and saved, in red', async () => {
  const { user, onSave } = renderEditor(split())

  await openPlan(user, workoutAt(0), 'Back Squat')
  const remove = screen.getByRole('button', { name: 'Remove from Workout' })
  expect(remove).toHaveClass('btn-danger')
  await user.click(remove)

  expect(planNamesShown(workoutAt(0))).toEqual(['Flat Bench', 'Cable Row'])
  const program = await save(user, onSave)
  expect(program.workouts[0].exercises).toEqual([benchPlan, rowPlan])
})

test('O15 Remove on a Workout from initial hides it: no longer shown, saved with hidden: true', async () => {
  const { user, onSave } = renderEditor(split())

  const remove = within(workoutAt(1)).getByRole('button', { name: 'Remove Lower' })
  expect(remove).toHaveClass('btn-danger')
  await user.click(remove)

  expect(workoutNamesShown()).toEqual(['Upper'])
  const program = await save(user, onSave)
  expect(program.workouts.map((w) => w.id)).toEqual(['wa', 'wb'])
  expect(program.workouts[1]).toMatchObject({ id: 'wb', name: 'Lower', hidden: true })
})

test('O15 Remove on a Workout added in this edit drops it from what is saved', async () => {
  const { user, onSave } = renderEditor(split())

  await user.click(screen.getByRole('button', { name: 'Add workout' }))
  expect(workouts()).toHaveLength(3)
  await user.click(within(workoutAt(2)).getByRole('button', { name: 'Remove Workout 3' }))

  expect(workoutNamesShown()).toEqual(['Upper', 'Lower'])
  const program = await save(user, onSave)
  expect(program.workouts.map((w) => w.id)).toEqual(['wa', 'wb'])
})

test('O15 a Workout already hidden in initial is not shown, and is saved unchanged', async () => {
  const initial = split()
  const retired = { id: 'wc', name: 'Retired', exercises: [{ ...rowPlan }], hidden: true }
  initial.workouts.push(retired)
  const { user, onSave } = renderEditor(initial)

  expect(workoutNamesShown()).toEqual(['Upper', 'Lower'])
  const program = await save(user, onSave)
  expect(program.workouts.find((w) => w.id === 'wc')).toEqual({
    id: 'wc',
    name: 'Retired',
    exercises: [rowPlan],
    hidden: true,
  })
})

test('O15 an added Workout gets a workout- id and its typed name, and the Program keeps initial.id and its typed name', async () => {
  const { user, onSave } = renderEditor(blank(), { isNew: true })

  await user.type(screen.getByLabelText('Program name'), 'Push Pull')
  await user.click(screen.getByRole('button', { name: 'Add workout' }))
  await user.type(workoutNameInputs()[0], 'Push')
  await user.click(screen.getByRole('button', { name: 'Add workout' }))
  await user.type(workoutNameInputs()[1], 'Pull')
  await pickInto(user, workoutAt(0), 'push', 'Pushups')
  await pickInto(user, workoutAt(1), 'fly', 'Dumbbell Incline Fly')

  const program = await save(user, onSave)
  expect(program.id).toBe('user-new')
  expect(program.name).toBe('Push Pull')
  expect(program.workouts.map((w) => w.name)).toEqual(['Push', 'Pull'])
  expect(program.workouts[0].id).toMatch(/^workout-\S+$/)
  expect(program.workouts[0].id).not.toBe(program.workouts[1].id)
  expect(program.workouts.map((w) => w.exercises)).toEqual([
    [{ exerciseId: 'Pushups', sets: 3, repRange: [8, 12], restSeconds: 90 }],
    [{ exerciseId: 'Dumbbell_Incline_Fly', sets: 3, repRange: [8, 12], restSeconds: 90 }],
  ])
})

test('O15 Cancel calls onCancel and never onSave', async () => {
  const { user, onSave, onCancel } = renderEditor(split())

  await reorder(user, workoutAt(0))
  await user.click(screen.getByRole('button', { name: 'Move Upper down' }))
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Discard' }))

  expect(onCancel).toHaveBeenCalledTimes(1)
  expect(onSave).not.toHaveBeenCalled()
})

// --- DX-17: the Plan editor page ----------------------------------------------------------------

test('DX-17 the Plan editor holds at most 8 rows: steppers, AMRAP, Swap, then Remove from Workout', async () => {
  const { user } = renderEditor(split())

  await openPlan(user, workoutAt(0), 'Back Squat')

  const rows = document.querySelectorAll('.plan-editor-row')
  expect(rows.length).toBeLessThanOrEqual(8)
  for (const label of ['Sets', 'Min reps', 'Max reps', 'Rest', 'Starting weight']) {
    expect(screen.getByRole('group', { name: label })).toBeInTheDocument()
  }
  expect(screen.getByRole('switch', { name: 'Last set AMRAP' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Swap exercise' })).toBeInTheDocument()
  expect(screen.queryAllByRole('spinbutton')).toHaveLength(0)
  // The list is pushed aside while the Plan is edited.
  expect(screen.queryByRole('button', { name: 'Add workout' })).toBeNull()
})

test('DX-17 Back returns to the list with the edited Plan read on its row', async () => {
  const { user } = renderEditor(split())

  await openPlan(user, workoutAt(0), 'Back Squat')
  await user.click(screen.getByRole('button', { name: 'Increase Sets' }))
  await user.click(screen.getByRole('button', { name: 'Decrease Max reps' }))
  await back(user)

  expect(planRow(workoutAt(0), 'Back Squat')).toHaveAccessibleName('Back Squat, 4 × 8–9 · 60 kg')
})

test('DX-17 Min reps cannot pass Max reps, nor Max reps fall below Min reps', async () => {
  const initial = split()
  initial.workouts[1].exercises = [{ ...pressPlan }]
  const { user } = renderEditor(initial)

  await openPlan(user, workoutAt(1), 'Overhead Press')

  expect(screen.getByRole('button', { name: 'Increase Min reps' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Decrease Max reps' })).toBeDisabled()
})

test('O17 DX-17 a Bodyweight Plan has no Starting weight stepper: its Load reads instead', async () => {
  const initial = split()
  initial.workouts[1].exercises.push({ exerciseId: 'dips', sets: 3, repRange: [6, 10], restSeconds: 90 })
  const { user } = renderEditor(initial)

  expect(planRow(workoutAt(1), 'Parallel Dips')).toHaveAccessibleName('Parallel Dips, 3 × 6–10 · BW')
  await openPlan(user, workoutAt(1), 'Parallel Dips')

  expect(screen.queryByRole('group', { name: 'Starting weight' })).toBeNull()
  expect(screen.getByText('Load')).toBeInTheDocument()
})

// --- V1-09: Cancel asks before throwing an edit away --------------------------------------------

test('V1-09 Cancel with no changes leaves at once', async () => {
  const { user, onCancel } = renderEditor(split())

  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(onCancel).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('V1-09 Cancel after one change asks "Discard 1 change?", and Keep editing keeps the value', async () => {
  const { user, onCancel } = renderEditor(split())
  await openPlan(user, workoutAt(0), 'Flat Bench')
  await user.click(screen.getByRole('button', { name: 'Increase Sets' }))
  await back(user)

  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  const ask = screen.getByRole('dialog', { name: 'Discard 1 change?' })
  expect(onCancel).not.toHaveBeenCalled()
  await user.click(within(ask).getByRole('button', { name: 'Keep editing' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(planRow(workoutAt(0), 'Flat Bench')).toHaveAccessibleName(/^Flat Bench, 5 × 6–8/)
})

test('V1-09 the question counts each change, and Discard leaves without saving', async () => {
  const { user, onCancel, onSave } = renderEditor(split())
  await openPlan(user, workoutAt(0), 'Flat Bench')
  await user.click(screen.getByRole('button', { name: 'Increase Sets' }))
  await back(user)
  const name = screen.getByLabelText('Program name')
  await user.clear(name)
  await user.type(name, 'Split 2')

  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  const ask = screen.getByRole('dialog', { name: 'Discard 2 changes?' })
  await user.click(within(ask).getByRole('button', { name: 'Discard' }))

  expect(onCancel).toHaveBeenCalledTimes(1)
  expect(onSave).not.toHaveBeenCalled()
})

test('V1-09 a field changed and changed back counts as no change', async () => {
  const { user, onCancel } = renderEditor(split())
  await openPlan(user, workoutAt(0), 'Flat Bench')
  await user.click(screen.getByRole('button', { name: 'Increase Sets' }))
  await user.click(screen.getByRole('button', { name: 'Decrease Sets' }))
  await back(user)

  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(onCancel).toHaveBeenCalledTimes(1)
})

// --- UX v6 (V5-10): the load the Plan is on now, and Rest as m:ss ---------------------------

test('V6 V5-10 a Plan already lifted shows the load it is on now beside its Starting weight', async () => {
  const { user } = renderEditor(split(), { nowLoad: (id) => (id === 'squat' ? '47.5' : null) })

  await openPlan(user, workoutAt(0), 'Back Squat')

  expect(screen.getByText('Now 47.5 kg')).toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'Starting weight' })).toBeInTheDocument()
})

test('V6 V5-10 DX-17 Rest reads as m:ss, steps by 15 s, and is stored in seconds', async () => {
  const { user, onSave } = renderEditor(split())

  await openPlan(user, workoutAt(0), 'Back Squat')
  expect(stepped('Rest')).toBe('1:30')
  await user.click(screen.getByRole('button', { name: 'Increase Rest' }))
  await user.click(screen.getByRole('button', { name: 'Increase Rest' }))
  await user.click(screen.getByRole('button', { name: 'Increase Rest' }))
  expect(stepped('Rest')).toBe('2:15')
  await back(user)

  const program = await save(user, onSave)
  expect(program.workouts[0].exercises[1].restSeconds).toBe(135)
})
