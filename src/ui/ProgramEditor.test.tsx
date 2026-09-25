// E9-T7: the Program editor. A Program's name, Workouts and Plans are built and rearranged on
// one screen, with Exercises picked from the library through `Add exercise` -> search -> `Pick`.
//
// Structure these tests rely on, beyond the ticket's labels: each visible Workout is a
// `<fieldset>` holding its `Workout name` input, and each of its Plans is an `<li>` holding
// that Plan's `Sets` input. A Workout's own `Move up` / `Move down` sit outside its Plans' `<li>`s.
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
    invertProgress: false,
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

async function save(
  user: ReturnType<typeof userEvent.setup>,
  onSave: Mock<(p: Program) => void>,
): Promise<Program> {
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(onSave).toHaveBeenCalledTimes(1)
  return onSave.mock.calls[0][0]
}

function workoutNameInputs(): HTMLInputElement[] {
  return screen.queryAllByLabelText('Workout name') as HTMLInputElement[]
}

/** The visible Workouts, top to bottom. */
function workouts(): HTMLElement[] {
  return workoutNameInputs().map((input) => {
    const group = input.closest('fieldset')
    if (group === null) throw new Error('a Workout name input is not inside a <fieldset>')
    return group
  })
}

/** The visible Workout at `index`, asserting it is there. */
function workoutAt(index: number): HTMLElement {
  const all = workouts()
  expect(all.length, 'visible Workouts').toBeGreaterThan(index)
  return all[index]
}

function workoutNamesShown(): string[] {
  return workoutNameInputs().map((input) => input.value)
}

/** A Workout's own button (not one of its Plans'). */
function workoutButton(workout: HTMLElement, name: string): HTMLElement {
  const own = within(workout)
    .getAllByRole('button', { name })
    .filter((button) => {
      const item = button.closest('li')
      return item === null || !workout.contains(item)
    })
  if (own.length !== 1) throw new Error(`expected one Workout-level "${name}", found ${own.length}`)
  return own[0]
}

/** A Workout's Plans, top to bottom. */
function plans(workout: HTMLElement): HTMLElement[] {
  return within(workout)
    .queryAllByLabelText('Sets')
    .map((input) => {
      const item = input.closest('li')
      if (item === null) throw new Error('a Plan\'s Sets input is not inside an <li>')
      return item
    })
}

function planNamesShown(workout: HTMLElement): string[] {
  return plans(workout).map(
    (item) => NAMES.find((name) => (item.textContent ?? '').includes(name)) ?? '(unnamed)',
  )
}

function planByName(workout: HTMLElement, name: string): HTMLElement {
  const item = plans(workout).find((p) => (p.textContent ?? '').includes(name))
  if (item === undefined) throw new Error(`no Plan for ${name}`)
  return item
}

function field(scope: HTMLElement, label: string): HTMLInputElement {
  return within(scope).getByLabelText(label) as HTMLInputElement
}

async function pickInto(
  user: ReturnType<typeof userEvent.setup>,
  workout: HTMLElement,
  query: string,
  name: string,
): Promise<void> {
  await user.click(within(workout).getByRole('button', { name: 'Add exercise' }))
  await user.type(screen.getByLabelText('Search exercises'), query)
  const row = screen
    .getAllByRole('listitem')
    .find(
      (item) =>
        (item.textContent ?? '').includes(name) &&
        within(item).queryByRole('button', { name: 'Pick' }) !== null,
    )
  if (row === undefined) throw new Error(`no pickable row for ${name}`)
  await user.click(within(row).getByRole('button', { name: 'Pick' }))
}

function sessionsPerWeek(): HTMLInputElement {
  return screen.getByLabelText('Sessions per week') as HTMLInputElement
}

// --- O14: a new Plan's defaults, and Sessions per week ------------------------------------------

test('O14 a Plan added through Add exercise, search and Pick shows 3 sets, 8-12 reps and 90 s rest', async () => {
  const { user } = renderEditor(split())

  await pickInto(user, workoutAt(1), 'fly', 'Dumbbell Incline Fly')

  const added = planByName(workoutAt(1), 'Dumbbell Incline Fly')
  expect(field(added, 'Sets').value).toBe('3')
  expect(field(added, 'Min reps').value).toBe('8')
  expect(field(added, 'Max reps').value).toBe('12')
  expect(field(added, 'Rest (s)').value).toBe('90')
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
  expect(program.workouts[1].exercises[1].startWeightKg).toBeUndefined()
})

test("O14 a picked Plan's Starting weight (kg) is empty, with the Exercise's own start weight as its placeholder", async () => {
  const { user } = renderEditor(split())

  await pickInto(user, workoutAt(1), 'fly', 'Dumbbell Incline Fly')

  const weight = field(planByName(workoutAt(1), 'Dumbbell Incline Fly'), 'Starting weight (kg)')
  expect(weight.value).toBe('')
  expect(weight).toHaveAttribute('placeholder', '12.5')
})

test("O14 a Plan with a starting weight shows it, and one without shows its Exercise's placeholder", () => {
  renderEditor(split())

  const upper = workoutAt(0)
  expect(field(planByName(upper, 'Flat Bench'), 'Starting weight (kg)').value).toBe('60')
  const squat = field(planByName(upper, 'Back Squat'), 'Starting weight (kg)')
  expect(squat.value).toBe('')
  expect(squat).toHaveAttribute('placeholder', '60')
})

test('O14 a starting weight typed into a picked Plan is saved as its startWeightKg', async () => {
  const { user, onSave } = renderEditor(split())

  await pickInto(user, workoutAt(1), 'dead', 'Barbell Deadlift')
  await user.type(
    field(planByName(workoutAt(1), 'Barbell Deadlift'), 'Starting weight (kg)'),
    '100',
  )

  const program = await save(user, onSave)
  expect(program.workouts[1].exercises[1]).toEqual({
    exerciseId: 'Barbell_Deadlift',
    sets: 3,
    repRange: [8, 12],
    restSeconds: 90,
    startWeightKg: 100,
  })
})

test('O14 the exercise search lists only library Exercises whose name matches, case-insensitively', async () => {
  const { user } = renderEditor(split())

  await user.click(within(workoutAt(0)).getByRole('button', { name: 'Add exercise' }))
  await user.type(screen.getByLabelText('Search exercises'), 'BARBELL')

  expect(screen.getAllByRole('button', { name: 'Pick' })).toHaveLength(1)
  expect(screen.getByText('Barbell Deadlift')).toBeInTheDocument()
  expect(screen.queryByText('Dumbbell Incline Fly')).toBeNull()
})

test('O14 Pick closes the exercise search', async () => {
  const { user } = renderEditor(split())

  await pickInto(user, workoutAt(0), 'push', 'Pushups')

  expect(screen.queryByLabelText('Search exercises')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Pick' })).toBeNull()
})

test('O14 Sessions per week follows the number of Workouts as they are added and removed', async () => {
  const { user, onSave } = renderEditor(blank(), { isNew: true })

  await user.click(screen.getByRole('button', { name: 'Add workout' }))
  expect(sessionsPerWeek().value).toBe('1')
  await user.click(screen.getByRole('button', { name: 'Add workout' }))
  expect(sessionsPerWeek().value).toBe('2')
  await user.click(screen.getByRole('button', { name: 'Add workout' }))
  expect(sessionsPerWeek().value).toBe('3')
  await user.click(within(workoutAt(2)).getByRole('button', { name: 'Remove workout' }))
  expect(sessionsPerWeek().value).toBe('2')

  const program = await save(user, onSave)
  expect(program.sessionsPerWeek).toBe(2)
})

test('O14 Sessions per week stops following the Workouts once it is changed by hand', async () => {
  const { user, onSave } = renderEditor(blank(), { isNew: true })

  await user.click(screen.getByRole('button', { name: 'Add workout' }))
  await user.click(screen.getByRole('button', { name: 'Add workout' }))
  await user.clear(sessionsPerWeek())
  await user.type(sessionsPerWeek(), '4')
  await user.click(screen.getByRole('button', { name: 'Add workout' }))
  expect(sessionsPerWeek().value).toBe('4')
  await user.click(within(workoutAt(0)).getByRole('button', { name: 'Remove workout' }))
  expect(sessionsPerWeek().value).toBe('4')

  const program = await save(user, onSave)
  expect(program.sessionsPerWeek).toBe(4)
})

test('O14 Sessions per week counts only the visible Workouts, not hidden ones', async () => {
  const initial = split()
  initial.workouts.push({ id: 'wc', name: 'Retired', exercises: [{ ...rowPlan }], hidden: true })
  const { user, onSave } = renderEditor(initial)

  expect(sessionsPerWeek().value).toBe('2')
  await user.click(screen.getByRole('button', { name: 'Add workout' }))
  expect(sessionsPerWeek().value).toBe('3')

  const program = await save(user, onSave)
  expect(program.sessionsPerWeek).toBe(3)
})

// --- O15: rearranging, removing, Cancel ---------------------------------------------------------

test('O15 Move down on the first Workout puts it second, shown and saved', async () => {
  const { user, onSave } = renderEditor(split())

  await user.click(workoutButton(workoutAt(0), 'Move down'))

  expect(workoutNamesShown()).toEqual(['Lower', 'Upper'])
  const program = await save(user, onSave)
  expect(program.workouts.map((w) => w.id)).toEqual(['wb', 'wa'])
  expect(program.workouts[1].exercises).toEqual([benchPlan, squatPlan, rowPlan])
})

test('O15 Move up on the second Workout puts it first, shown and saved', async () => {
  const { user, onSave } = renderEditor(split())

  await user.click(workoutButton(workoutAt(1), 'Move up'))

  expect(workoutNamesShown()).toEqual(['Lower', 'Upper'])
  const program = await save(user, onSave)
  expect(program.workouts.map((w) => w.id)).toEqual(['wb', 'wa'])
})

test('O15 Move up on a Plan swaps it with the one above, its numbers kept, shown and saved', async () => {
  const { user, onSave } = renderEditor(split())

  await user.click(
    within(planByName(workoutAt(0), 'Back Squat')).getByRole('button', { name: 'Move up' }),
  )

  expect(planNamesShown(workoutAt(0))).toEqual(['Back Squat', 'Flat Bench', 'Cable Row'])
  const program = await save(user, onSave)
  expect(program.workouts[0].exercises).toEqual([squatPlan, benchPlan, rowPlan])
})

test('O15 Move down on a Plan swaps it with the one below, shown and saved', async () => {
  const { user, onSave } = renderEditor(split())

  await user.click(
    within(planByName(workoutAt(0), 'Back Squat')).getByRole('button', { name: 'Move down' }),
  )

  expect(planNamesShown(workoutAt(0))).toEqual(['Flat Bench', 'Cable Row', 'Back Squat'])
  const program = await save(user, onSave)
  expect(program.workouts[0].exercises).toEqual([benchPlan, rowPlan, squatPlan])
})

test('O15 Remove on a Plan drops it, shown and saved', async () => {
  const { user, onSave } = renderEditor(split())

  await user.click(
    within(planByName(workoutAt(0), 'Back Squat')).getByRole('button', { name: 'Remove' }),
  )

  expect(planNamesShown(workoutAt(0))).toEqual(['Flat Bench', 'Cable Row'])
  const program = await save(user, onSave)
  expect(program.workouts[0].exercises).toEqual([benchPlan, rowPlan])
})

test('O15 Remove workout on a Workout from initial hides it: no longer shown, saved with hidden: true', async () => {
  const { user, onSave } = renderEditor(split())

  await user.click(within(workoutAt(1)).getByRole('button', { name: 'Remove workout' }))

  expect(workoutNamesShown()).toEqual(['Upper'])
  const program = await save(user, onSave)
  expect(program.workouts.map((w) => w.id)).toEqual(['wa', 'wb'])
  expect(program.workouts[0].hidden).not.toBe(true)
  expect(program.workouts[1]).toMatchObject({ id: 'wb', name: 'Lower', hidden: true })
})

test('O15 Remove workout on a Workout added in this edit drops it from what is saved', async () => {
  const { user, onSave } = renderEditor(split())

  await user.click(screen.getByRole('button', { name: 'Add workout' }))
  expect(workouts()).toHaveLength(3)
  await user.click(within(workoutAt(2)).getByRole('button', { name: 'Remove workout' }))

  expect(workoutNamesShown()).toEqual(['Upper', 'Lower'])
  const program = await save(user, onSave)
  expect(program.workouts.map((w) => w.id)).toEqual(['wa', 'wb'])
  expect(program.workouts.every((w) => w.hidden !== true)).toBe(true)
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

  const program = await save(user, onSave)
  expect(program.id).toBe('user-new')
  expect(program.name).toBe('Push Pull')
  expect(program.units).toBe('kg')
  expect(program.workouts.map((w) => w.name)).toEqual(['Push', 'Pull'])
  expect(program.workouts[0].id).toMatch(/^workout-\S+$/)
  expect(program.workouts[1].id).toMatch(/^workout-\S+$/)
  expect(program.workouts[0].id).not.toBe(program.workouts[1].id)
  expect(program.workouts.map((w) => w.exercises)).toEqual([[], []])
})

test('O15 Move up on the first Workout and Move down on the last are disabled, the others enabled', async () => {
  const { user } = renderEditor(split())

  expect(workoutButton(workoutAt(0), 'Move up')).toBeDisabled()
  expect(workoutButton(workoutAt(0), 'Move down')).toBeEnabled()
  expect(workoutButton(workoutAt(1), 'Move up')).toBeEnabled()
  expect(workoutButton(workoutAt(1), 'Move down')).toBeDisabled()

  await user.click(workoutButton(workoutAt(0), 'Move down'))

  expect(workoutButton(workoutAt(0), 'Move up')).toBeDisabled()
  expect(workoutButton(workoutAt(1), 'Move down')).toBeDisabled()
  expect(workoutButton(workoutAt(1), 'Move up')).toBeEnabled()
})

test("O15 Move up on a Workout's first Plan and Move down on its last are disabled, the others enabled", async () => {
  const { user } = renderEditor(split())

  const [first, middle, last] = plans(workoutAt(0))
  expect(within(first).getByRole('button', { name: 'Move up' })).toBeDisabled()
  expect(within(first).getByRole('button', { name: 'Move down' })).toBeEnabled()
  expect(within(middle).getByRole('button', { name: 'Move up' })).toBeEnabled()
  expect(within(middle).getByRole('button', { name: 'Move down' })).toBeEnabled()
  expect(within(last).getByRole('button', { name: 'Move up' })).toBeEnabled()
  expect(within(last).getByRole('button', { name: 'Move down' })).toBeDisabled()

  const [only] = plans(workoutAt(1))
  expect(within(only).getByRole('button', { name: 'Move up' })).toBeDisabled()
  expect(within(only).getByRole('button', { name: 'Move down' })).toBeDisabled()

  await user.click(within(last).getByRole('button', { name: 'Move up' }))
  const after = plans(workoutAt(0))
  expect(within(after[2]).getByRole('button', { name: 'Move down' })).toBeDisabled()
  expect(within(after[1]).getByRole('button', { name: 'Move down' })).toBeEnabled()
})

test('O15 Cancel calls onCancel and never onSave', async () => {
  const { user, onSave, onCancel } = renderEditor(split())

  await user.click(workoutButton(workoutAt(0), 'Move down'))
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(onCancel).toHaveBeenCalledTimes(1)
  expect(onSave).not.toHaveBeenCalled()
})

// --- O17: no starting weight for a Bodyweight Exercise ------------------------------------------

test('O17 a picked Bodyweight Exercise\'s Plan has no Starting weight (kg) field', async () => {
  const { user } = renderEditor(split())

  await pickInto(user, workoutAt(1), 'push', 'Pushups')

  const lower = workoutAt(1)
  expect(planNamesShown(lower)).toEqual(['Overhead Press', 'Pushups'])
  expect(within(planByName(lower, 'Pushups')).queryByLabelText('Starting weight (kg)')).toBeNull()
  expect(
    within(planByName(lower, 'Overhead Press')).getByLabelText('Starting weight (kg)'),
  ).toBeInTheDocument()
})

test('O17 a Bodyweight Plan already in the Program has no Starting weight (kg) field', () => {
  const initial = split()
  initial.workouts[1].exercises.push({
    exerciseId: 'dips',
    sets: 3,
    repRange: [6, 10],
    restSeconds: 90,
  })
  renderEditor(initial)

  const lower = workoutAt(1)
  expect(
    within(planByName(lower, 'Parallel Dips')).queryByLabelText('Starting weight (kg)'),
  ).toBeNull()
  expect(
    within(planByName(lower, 'Overhead Press')).getByLabelText('Starting weight (kg)'),
  ).toBeInTheDocument()
})
