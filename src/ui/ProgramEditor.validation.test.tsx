// E9-T8: the editor refuses a broken Program. `validateProgram` (E9-T1) is wired into the
// editor (E9-T7): every fault it names is shown beside the field its `path` names, `Save` is
// disabled while any fault remains, and `Cancel` is never blocked by one.
//
// Each fixture below carries exactly one fault, so a test's assertion is never ambiguous about
// which fault produced the message it finds.
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

const exercises: Exercise[] = [
  exercise({ id: 'bench', name: 'Flat Bench' }),
  exercise({ id: 'squat', name: 'Back Squat' }),
  exercise({ id: 'row', name: 'Cable Row' }),
]
const byId = new Map(exercises.map((e) => [e.id, e] as const))
const resolve = (id: string) => byId.get(id)

const library: LibraryExercise[] = [libraryEntry({ id: 'row', name: 'Cable Row' })]

const validPlan: ExercisePlan = { exerciseId: 'bench', sets: 3, repRange: [8, 12], restSeconds: 90 }
const badRepRangePlan: ExercisePlan = {
  exerciseId: 'squat',
  sets: 3,
  repRange: [10, 8],
  restSeconds: 90,
}

function validProgram(): Program {
  return {
    id: 'p1',
    name: 'Test',
    units: 'kg',
    sessionsPerWeek: 1,
    workouts: [{ id: 'wa', name: 'Upper', exercises: [{ ...validPlan }] }],
  }
}

function emptyProgramName(): Program {
  const p = validProgram()
  p.name = ''
  return p
}

function badSessions(): Program {
  const p = validProgram()
  p.sessionsPerWeek = 20
  return p
}

function noWorkouts(): Program {
  const p = validProgram()
  p.workouts = []
  return p
}

function emptyWorkoutExercises(): Program {
  const p = validProgram()
  p.workouts[0].exercises = []
  return p
}

function blankWorkoutName(): Program {
  const p = validProgram()
  p.workouts[0].name = ''
  return p
}

function badRepRange(): Program {
  const p = validProgram()
  p.workouts[0].exercises = [{ ...badRepRangePlan }]
  return p
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

function saveButton(): HTMLElement {
  return screen.getByRole('button', { name: 'Save' })
}

/** The accessible description text an input's `aria-describedby` points at, or `null`. */
function describedByText(input: HTMLElement): string | null {
  const id = input.getAttribute('aria-describedby')
  if (id === null) return null
  const texts = id
    .split(/\s+/)
    .map((one) => document.getElementById(one)?.textContent ?? '')
    .filter((text) => text !== '')
  return texts.length === 0 ? null : texts.join(' ')
}

function workoutNameInputs(): HTMLInputElement[] {
  return screen.queryAllByLabelText('Workout name') as HTMLInputElement[]
}

function workoutAt(index: number): HTMLElement {
  const input = workoutNameInputs()[index]
  const group = input?.closest('fieldset')
  if (group === null || group === undefined) throw new Error(`no visible Workout at ${index}`)
  return group
}

function planByName(workout: HTMLElement, name: string): HTMLElement {
  const item = within(workout)
    .queryAllByText(name)
    .map((el) => el.closest('li'))
    .find((el): el is HTMLLIElement => el !== null)
  if (item === undefined) throw new Error(`no Plan for ${name}`)
  return item
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

// --- O16: a named fault disables Save, described on its field, gone once fixed -------------------

test('O16 with no fault named by validateProgram, Save is enabled', () => {
  renderEditor(validProgram())

  expect(saveButton()).toBeEnabled()
})

test('O16 the empty-name fault disables Save and is the accessible description of Program name, until fixed', async () => {
  const { user } = renderEditor(emptyProgramName())

  const nameInput = screen.getByLabelText('Program name')
  expect(describedByText(nameInput)).toBe('Name is empty')
  expect(saveButton()).toBeDisabled()

  await user.type(nameInput, 'Named')

  expect(describedByText(nameInput)).not.toBe('Name is empty')
  expect(screen.queryByText('Name is empty')).toBeNull()
  expect(saveButton()).toBeEnabled()
})

test('O16 the sessions-per-week fault disables Save and is the accessible description of Sessions per week, until fixed', async () => {
  const { user } = renderEditor(badSessions())

  const sessions = screen.getByLabelText('Sessions per week')
  expect(describedByText(sessions)).toBe('Sessions per week: 1 to 14')
  expect(saveButton()).toBeDisabled()

  await user.clear(sessions)
  await user.type(sessions, '5')

  expect(screen.queryByText('Sessions per week: 1 to 14')).toBeNull()
  expect(saveButton()).toBeEnabled()
})

test('O16 a rep-range fault disables Save and describes both Min reps and Max reps with the same message, until fixed', async () => {
  const { user } = renderEditor(badRepRange())

  const plan = planByName(workoutAt(0), 'Back Squat')
  const minReps = within(plan).getByLabelText('Min reps')
  const maxReps = within(plan).getByLabelText('Max reps')
  expect(describedByText(minReps)).toBe('Rep range: min is more than max')
  expect(describedByText(maxReps)).toBe('Rep range: min is more than max')
  expect(saveButton()).toBeDisabled()

  await user.clear(minReps)
  await user.type(minReps, '5')

  expect(screen.queryByText('Rep range: min is more than max')).toBeNull()
  expect(saveButton()).toBeEnabled()
})

test("O16 the blank-workout-name fault disables Save and is the accessible description of that Workout's Workout name, until fixed", async () => {
  const { user } = renderEditor(blankWorkoutName())

  const workoutNameInput = within(workoutAt(0)).getByLabelText('Workout name')
  expect(describedByText(workoutNameInput)).toBe('Name is empty')
  expect(saveButton()).toBeDisabled()

  await user.type(workoutNameInput, 'Upper')

  expect(screen.queryByText('Name is empty')).toBeNull()
  expect(saveButton()).toBeEnabled()
})

test('O16 the no-workouts fault disables Save and is shown under the Workouts heading, until fixed', async () => {
  const { user } = renderEditor(noWorkouts())

  const heading = screen.getByRole('heading', { name: 'Workouts' })
  const message = screen.getByText('Add a workout')
  expect(heading.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(saveButton()).toBeDisabled()

  await user.click(screen.getByRole('button', { name: 'Add workout' }))
  await user.type(workoutNameInputs()[0], 'Upper')
  await pickInto(user, workoutAt(0), 'row', 'Cable Row')

  expect(screen.queryByText('Add a workout')).toBeNull()
  expect(saveButton()).toBeEnabled()
})

test("O16 the no-exercises fault disables Save and is shown under that Workout's Plans, until fixed", async () => {
  const { user } = renderEditor(emptyWorkoutExercises())

  const workout = workoutAt(0)
  expect(within(workout).getByText('Add an exercise')).toBeInTheDocument()
  expect(saveButton()).toBeDisabled()

  await pickInto(user, workout, 'row', 'Cable Row')

  expect(screen.queryByText('Add an exercise')).toBeNull()
  expect(saveButton()).toBeEnabled()
})

// --- O16: Cancel is never blocked by a fault -----------------------------------------------------

test('O16 Cancel calls onCancel and never onSave while a fault is shown, leaving the stored Programs unchanged', async () => {
  const { user, onSave, onCancel } = renderEditor(noWorkouts())

  expect(screen.getByText('Add a workout')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(onCancel).toHaveBeenCalledTimes(1)
  expect(onSave).not.toHaveBeenCalled()
})
