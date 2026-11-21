// Progress Dashboard S7b / DX-17: the Program editor's bar, its Workouts' live size, a Plan row's
// drag handle, the Plan editor page (Swap exercise, Exercise settings), and the sticky "Impact on
// weekly volume" card.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { Mock } from 'vitest'
import { ProgramEditor } from './ProgramEditor'
import { moveTo } from './program/listMoves'
import type { ExerciseSettings, ProgramEditorProps } from './ProgramEditor'
import type { Exercise, LibraryExercise, Program } from '../types'

function libraryEntry(id: string, name: string, primary: LibraryExercise['primaryMuscles']): LibraryExercise {
  return {
    id,
    name,
    force: null,
    level: 'beginner',
    mechanic: null,
    equipment: 'barbell',
    primaryMuscles: primary,
    secondaryMuscles: [],
    instructions: [],
    category: 'strength',
    images: [],
  }
}

const exercises: Exercise[] = [
  { id: 'squat', name: 'Back Squat', weightStep: 2.5, startWeight: 60, bodyweight: false, libraryId: 'Squat_Lib' },
  { id: 'bench', name: 'Flat Bench', weightStep: 2.5, startWeight: 40, bodyweight: false, libraryId: 'Bench_Lib' },
  {
    id: 'pullup',
    name: 'Assisted Pullup',
    weightStep: 1,
    startWeight: null,
    bodyweight: true,
    startLoadKg: -20,
    libraryId: 'Pullup_Lib',
  },
  { id: 'Leg_Press', name: 'Leg Press', weightStep: 5, startWeight: 80, bodyweight: false, libraryId: 'Leg_Press' },
]
const byId = new Map(exercises.map((e) => [e.id, e] as const))
const library: LibraryExercise[] = [
  libraryEntry('Squat_Lib', 'Squat lib', ['quadriceps']),
  libraryEntry('Bench_Lib', 'Bench lib', ['chest']),
  libraryEntry('Pullup_Lib', 'Pullup lib', ['lats']),
  libraryEntry('Leg_Press', 'Leg Press', ['quadriceps']),
]

/** One Workout done twice a week: each planned Set weighs 2 a week. */
function program(): Program {
  return {
    id: 'p',
    name: 'Strength',
    units: 'kg',
    sessionsPerWeek: 2,
    workouts: [
      {
        id: 'wa',
        name: 'Day A',
        exercises: [
          { exerciseId: 'squat', sets: 4, repRange: [8, 10], restSeconds: 180, startWeightKg: 70 },
          { exerciseId: 'bench', sets: 3, repRange: [8, 10], restSeconds: 90 },
          { exerciseId: 'pullup', sets: 3, repRange: [5, 8], restSeconds: 90 },
        ],
      },
    ],
  }
}

function renderEditor(overrides: Partial<ProgramEditorProps> = {}) {
  const onSave: Mock<(p: Program, settings?: ExerciseSettings) => void> = vi.fn()
  const user = userEvent.setup()
  render(
    <ProgramEditor
      initial={program()}
      isNew={false}
      resolve={(id) => byId.get(id)}
      library={library}
      gymEquipment={null}
      onSave={onSave}
      onCancel={vi.fn()}
      {...overrides}
    />,
  )
  return { onSave, user }
}

function planRow(name: string): HTMLElement {
  const row = screen.getByText(name, { selector: '.program-editor-plan-name' }).closest('li')
  if (row === null) throw new Error(`no Plan row for ${name}`)
  return row
}

function planNames(): string[] {
  return [...document.querySelectorAll('.program-editor-plan-name')].map((p) => p.textContent ?? '')
}

type User = ReturnType<typeof userEvent.setup>

/** DX-17: a tap on a Plan's row pushes its Plan editor. */
async function openPlan(user: User, name: string): Promise<void> {
  await user.click(screen.getByRole('button', { name: new RegExp(`^${name}, `) }))
}

async function back(user: User): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Back' }))
}

test('S7b the bar reads Cancel, Edit <program name> and Save', () => {
  renderEditor()

  expect(screen.getByRole('heading', { level: 1, name: 'Edit Strength' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
})

test('S7b the bar reads New program for a new Program, and a given title over either', () => {
  const { unmount } = render(
    <ProgramEditor
      initial={{ ...program(), name: '' }}
      isNew={true}
      resolve={(id) => byId.get(id)}
      library={library}
      gymEquipment={null}
      onSave={vi.fn()}
      onCancel={vi.fn()}
    />,
  )
  expect(screen.getByRole('heading', { level: 1, name: 'New program' })).toBeVisible()
  unmount()

  renderEditor({ title: 'Copy program' })
  expect(screen.getByRole('heading', { level: 1, name: 'Copy program' })).toBeVisible()
})

test("S7b a Workout's head shows its live sets and minutes, following an edit to Sets", async () => {
  const { user } = renderEditor()

  // workoutEstimate: 10 sets x 40 s + 4x180 + 3x90 + 3x90 rest, less the last 90 s = 1560 s.
  expect(screen.getByText('10 sets · ~26 min')).toBeVisible()

  await openPlan(user, 'Back Squat')
  await user.click(screen.getByRole('button', { name: 'Increase Sets' }))
  await back(user)

  // One more Set: 40 s of work and 180 s more rest.
  expect(screen.getByText('11 sets · ~30 min')).toBeVisible()
})

test('S7b DX-15 a row has no muscle dot, and a Bodyweight row reads its start Load', () => {
  renderEditor()

  expect(document.querySelector('.muscle-dot')).toBeNull()
  expect(screen.getByRole('button', { name: /^Assisted Pullup, / })).toHaveAccessibleName(
    'Assisted Pullup, 3 × 5–8 · BW−20',
  )
})

test('S7b the drag handle moves its row with the arrow keys and keeps the handle focused', async () => {
  const { user, onSave } = renderEditor()

  within(planRow('Back Squat')).getByRole('button', { name: 'Reorder Back Squat' }).focus()
  await user.keyboard('{ArrowDown}')

  expect(planNames()).toEqual(['Flat Bench', 'Back Squat', 'Assisted Pullup'])
  expect(screen.getByRole('button', { name: 'Reorder Back Squat' })).toHaveFocus()

  await user.keyboard('{ArrowDown}{ArrowDown}')
  expect(planNames()).toEqual(['Flat Bench', 'Assisted Pullup', 'Back Squat'])

  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(onSave.mock.calls[0][0].workouts[0].exercises.map((p) => p.exerciseId)).toEqual([
    'bench',
    'pullup',
    'squat',
  ])
})

test('S7b DX-17 Swap exercise on the Plan editor replaces its Exercise, keeping its numbers but not its starting weight', async () => {
  const { user, onSave } = renderEditor()

  await openPlan(user, 'Back Squat')
  await user.click(screen.getByRole('button', { name: 'Swap exercise' }))
  const dialog = screen.getByRole('dialog', { name: 'Swap Back Squat' })
  await user.type(within(dialog).getByLabelText('Search exercises'), 'press')
  await user.click(within(dialog).getAllByRole('button', { name: 'Leg Press' })[0])

  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('heading', { level: 1, name: 'Leg Press' })).toBeVisible()
  await back(user)
  expect(planNames()).toEqual(['Leg Press', 'Flat Bench', 'Assisted Pullup'])

  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(onSave.mock.calls[0][0].workouts[0].exercises[0]).toEqual({
    exerciseId: 'Leg_Press',
    sets: 4,
    repRange: [8, 10],
    restSeconds: 180,
  })
})

test('DX-08 Swap leads with Similar exercises for the planned one', async () => {
  const { user } = renderEditor()

  await openPlan(user, 'Back Squat')
  await user.click(screen.getByRole('button', { name: 'Swap exercise' }))

  const similar = within(screen.getByRole('dialog')).getByRole('region', { name: 'Similar' })
  expect(within(similar).getByRole('button', { name: 'Leg Press' })).toBeInTheDocument()
})

test('S7b no impact card shows until an edit changes the planned week', () => {
  renderEditor()

  expect(screen.queryByRole('complementary', { name: 'Impact on weekly volume' })).toBeNull()
})

test("S7b raising a row's Sets shows its family's planned week before and after, and the change", async () => {
  const { user } = renderEditor()

  await openPlan(user, 'Back Squat')
  await user.click(screen.getByRole('button', { name: 'Increase Sets' }))
  await back(user)

  // Legs: 4 sets x 2 sessions a week = 8, now 5 x 2 = 10.
  const card = screen.getByRole('complementary', { name: 'Impact on weekly volume' })
  expect(within(card).getByText('Back Squat · sets 4 → 5')).toBeVisible()
  expect(within(card).getByText('Legs 8 → 10 sets/week')).toBeVisible()
  expect(within(card).getByText('Before')).toBeVisible()
  expect(within(card).getByText('After')).toBeVisible()
  // DX-15: the After bar is ink, not a muscle family colour.
  expect(card.querySelector('.program-editor-impact-bar-after')).not.toBeNull()
  expect(card.querySelector('[data-family]')).toBeNull()
})

test('S7b putting a row back as it was takes the impact card away', async () => {
  const { user } = renderEditor()

  await openPlan(user, 'Flat Bench')
  await user.click(screen.getByRole('button', { name: 'Increase Sets' }))
  await back(user)
  expect(screen.getByRole('complementary', { name: 'Impact on weekly volume' })).toBeVisible()

  await openPlan(user, 'Flat Bench')
  await user.click(screen.getByRole('button', { name: 'Decrease Sets' }))
  await back(user)
  expect(screen.queryByRole('complementary', { name: 'Impact on weekly volume' })).toBeNull()
})

test('moveTo takes an item out and puts it back at the given place', () => {
  expect(moveTo(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  expect(moveTo(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c'])
  expect(moveTo(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
})

test('DX-17 a Bodyweight Plan editor has steppers for Sets, reps and Rest, and no Starting weight', async () => {
  const { user } = renderEditor()

  await openPlan(user, 'Assisted Pullup')

  for (const name of ['Sets', 'Min reps', 'Max reps', 'Rest']) {
    expect(screen.getByRole('group', { name })).toBeInTheDocument()
  }
  expect(screen.queryByRole('group', { name: 'Starting weight' })).toBeNull()
  expect(screen.getByText('BW−20')).toBeVisible()
})

test('V1-16 without stored Exercise settings, a Plan editor offers no Bodyweight or Weight step', async () => {
  const { user } = renderEditor()

  await openPlan(user, 'Back Squat')

  expect(screen.queryByRole('switch', { name: 'Bodyweight exercise' })).toBeNull()
  expect(screen.queryByRole('combobox', { name: 'Back Squat weight step' })).toBeNull()
})

test("V1-16 a Plan editor shows its Exercise's stored step and Bodyweight, and Save hands back only what changed", async () => {
  const { user, onSave } = renderEditor({
    exerciseSettings: { weightSteps: { squat: 5 }, bodyweight: {} },
  })

  await openPlan(user, 'Back Squat')
  const bodyweight = screen.getByRole('switch', { name: 'Bodyweight exercise' })
  const step = screen.getByRole('combobox', { name: 'Back Squat weight step' })
  expect(bodyweight).not.toBeChecked()
  expect(step).toHaveValue('5')
  expect(screen.getByText('Weight step and Bodyweight apply to Back Squat in every workout.')).toBeVisible()

  await user.selectOptions(step, '2.5')
  await back(user)
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(onSave).toHaveBeenCalledTimes(1)
  expect(onSave.mock.calls[0][1]).toEqual({ weightSteps: { squat: 2.5 }, bodyweight: {} })
})

test('V1-16 turning Bodyweight on hides the step, swaps the kg stepper for the Load, and counts as a change', async () => {
  const onCancel = vi.fn()
  const { user, onSave } = renderEditor({
    exerciseSettings: { weightSteps: {}, bodyweight: {} },
    onCancel,
  })

  await openPlan(user, 'Flat Bench')
  await user.click(screen.getByRole('switch', { name: 'Bodyweight exercise' }))

  expect(screen.queryByRole('combobox', { name: 'Flat Bench weight step' })).toBeNull()
  expect(screen.queryByRole('group', { name: 'Starting weight' })).toBeNull()

  await back(user)
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onCancel).not.toHaveBeenCalled()
  expect(screen.getByRole('heading', { name: 'Discard 1 change?' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Keep editing' }))

  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(onSave.mock.calls[0][1]).toEqual({ weightSteps: {}, bodyweight: { bench: true } })
})

test('V1-16 a stored Bodyweight override shows on the row, and turning it back off and on again is no change', async () => {
  const { user, onSave } = renderEditor({
    exerciseSettings: { weightSteps: {}, bodyweight: { squat: true } },
  })

  expect(screen.getByRole('button', { name: /^Back Squat, / })).toHaveAccessibleName(/· BW/)
  await openPlan(user, 'Back Squat')
  expect(screen.getByRole('switch', { name: 'Bodyweight exercise' })).toBeChecked()

  await user.click(screen.getByRole('switch', { name: 'Bodyweight exercise' }))
  await user.click(screen.getByRole('switch', { name: 'Bodyweight exercise' }))
  await back(user)
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(onSave.mock.calls[0]).toHaveLength(1)
})
