// E12-T6: the History editor edits a draft of a finished Session and hands it to `onSave` in
// one piece. `onSave` is the component's boundary, so these tests assert the draft it receives;
// the store write behind it is covered in src/features/history/HistoryFeature.test.tsx.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { Mock } from 'vitest'
import { SessionEditor } from './SessionEditor'
import type { Exercise, Session, SetEntry } from '../types'

// --- fixtures -----------------------------------------------------------------------------------

const MINUTE = 60 * 1_000
/** Local wall-clock times, so the `datetime-local` values below are literals in any timezone. */
const START = new Date(2023, 10, 14, 18, 0).getTime()
const END = new Date(2023, 10, 14, 19, 0).getTime()

function entry(
  exerciseId: string,
  setIndex: number,
  weightKg: number | null,
  reps: number,
  loggedAt: number,
): SetEntry {
  return { exerciseId, setIndex, weightKg, reps, loggedAt }
}

const squat1 = entry('squat', 1, 60, 8, START + 10 * MINUTE)
const squat2 = entry('squat', 2, 62.5, 6, START + 20 * MINUTE)
const squat3 = entry('squat', 3, 65, 5, START + 30 * MINUTE)
const dips1 = entry('dips', 1, null, 10, START + 40 * MINUTE)

function finished(entries: SetEntry[] = [squat1, squat2, squat3, dips1]): Session {
  return {
    id: 's1',
    programId: 'p1',
    workoutId: 'wa',
    startedAt: START,
    finishedAt: END,
    entries,
    updatedAt: END,
  }
}

const exercises: Exercise[] = [
  {
    id: 'squat',
    libraryId: 'Barbell_Squat',
    name: 'Back squat',
    weightStep: 2.5,
    startWeight: 50,
    bodyweight: false,
    invertProgress: false,
  },
  {
    id: 'dips',
    libraryId: 'Dips',
    name: 'Dips',
    weightStep: 2.5,
    startWeight: null,
    bodyweight: true,
    invertProgress: false,
  },
]
const byId = new Map(exercises.map((exercise) => [exercise.id, exercise] as const))
const resolve = (id: string) => byId.get(id)

type Rendered = { onSave: Mock; onCancel: Mock }

function renderEditor(
  session: Session = finished(),
  onSave: Mock = vi.fn().mockResolvedValue(undefined),
): Rendered {
  const onCancel = vi.fn()
  render(
    <SessionEditor
      session={session}
      workoutName="Upper A"
      resolve={resolve}
      onSave={onSave}
      onCancel={onCancel}
    />,
  )
  return { onSave, onCancel }
}

function group(name: string): HTMLElement {
  return screen.getByRole('group', { name })
}

function startField(): HTMLInputElement {
  return screen.getByLabelText('Start') as HTMLInputElement
}

function endField(): HTMLInputElement {
  return screen.getByLabelText('End') as HTMLInputElement
}

function saveButton(): HTMLElement {
  return screen.getByRole('button', { name: 'Save' })
}

/** The draft `onSave` was handed, with its entries ordered by Exercise then `setIndex`. */
async function savedDraft(onSave: Mock): Promise<Session> {
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
  const draft = onSave.mock.calls[0][0] as Session
  return { ...draft, entries: ordered(draft.entries) }
}

function ordered(entries: SetEntry[]): SetEntry[] {
  return [...entries].sort(
    (one, other) =>
      one.exerciseId.localeCompare(other.exerciseId) || one.setIndex - other.setIndex,
  )
}

// --- O13: what the editor shows -----------------------------------------------------------------

test('O13 SessionEditor shows the Workout name as its heading', () => {
  renderEditor()

  expect(screen.getByRole('heading', { name: 'Upper A' })).toBeVisible()
})

test('O13 SessionEditor shows the start and end as editable local date-time fields', () => {
  renderEditor()

  expect(startField().type).toBe('datetime-local')
  expect(startField().value).toBe('2023-11-14T18:00')
  expect(startField()).toBeEnabled()
  expect(endField().type).toBe('datetime-local')
  expect(endField().value).toBe('2023-11-14T19:00')
  expect(endField()).toBeEnabled()
})

test('O13 SessionEditor groups the Sets by Exercise, each Set with an edit and a delete control', () => {
  renderEditor()

  const squat = group('Back squat')
  expect(within(squat).getByText('60 × 8')).toBeVisible()
  expect(within(squat).getByText('62.5 × 6')).toBeVisible()
  expect(within(squat).getByText('65 × 5')).toBeVisible()
  for (const setIndex of [1, 2, 3]) {
    expect(within(squat).getByRole('button', { name: `Edit set ${setIndex}` })).toBeVisible()
    expect(within(squat).getByRole('button', { name: `Delete set ${setIndex}` })).toBeVisible()
  }
  expect(within(squat).queryByRole('button', { name: 'Edit set 4' })).toBeNull()

  const dips = group('Dips')
  expect(within(dips).getByText('BW × 10')).toBeVisible()
  expect(within(dips).getByRole('button', { name: 'Edit set 1' })).toBeVisible()
  expect(within(dips).getByRole('button', { name: 'Delete set 1' })).toBeVisible()
  expect(within(dips).queryByText('60 × 8')).toBeNull()
})

test('O13 SessionEditor has one Add set under each Exercise', () => {
  renderEditor()

  expect(within(group('Back squat')).getAllByRole('button', { name: 'Add set' })).toHaveLength(1)
  expect(within(group('Dips')).getAllByRole('button', { name: 'Add set' })).toHaveLength(1)
})

test('O13 SessionEditor offers an enabled Save and a Cancel', () => {
  renderEditor()

  expect(saveButton()).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
})

// --- O14: editing the draft and saving it ---------------------------------------------------------

test('O14 SessionEditor saves an edited Set with its new values, keeping its setIndex and loggedAt', async () => {
  const { onSave } = renderEditor()
  const user = userEvent.setup()

  await user.click(within(group('Back squat')).getByRole('button', { name: 'Edit set 1' }))
  await user.click(within(screen.getByRole('group', { name: 'Weight (kg)' })).getByRole('button', { name: 'Increase weight' }))
  await user.click(within(screen.getByRole('group', { name: 'Reps' })).getByRole('button', { name: 'Increase reps' }))
  await user.click(saveButton())

  expect(await savedDraft(onSave)).toEqual({
    ...finished(),
    entries: [dips1, entry('squat', 1, 62.5, 9, START + 10 * MINUTE), squat2, squat3],
  })
})

test('O14 SessionEditor saves a deleted Set gone and the Exercise\'s later Sets renumbered down', async () => {
  const { onSave } = renderEditor()
  const user = userEvent.setup()

  await user.click(within(group('Back squat')).getByRole('button', { name: 'Delete set 1' }))
  expect(within(group('Back squat')).queryByText('60 × 8')).toBeNull()
  await user.click(saveButton())

  expect(await savedDraft(onSave)).toEqual({
    ...finished(),
    entries: [
      dips1,
      entry('squat', 1, 62.5, 6, START + 20 * MINUTE),
      entry('squat', 2, 65, 5, START + 30 * MINUTE),
    ],
  })
})

test('O14 SessionEditor adds a Set with the next setIndex, the last Set\'s values and loggedAt equal to finishedAt', async () => {
  const { onSave } = renderEditor()
  const user = userEvent.setup()

  await user.click(within(group('Back squat')).getByRole('button', { name: 'Add set' }))
  await user.click(saveButton())

  expect(await savedDraft(onSave)).toEqual({
    ...finished(),
    entries: [dips1, squat1, squat2, squat3, entry('squat', 4, 65, 5, END)],
  })
})

test('O14 SessionEditor adds a Set to a Bodyweight Exercise with no weight', async () => {
  const { onSave } = renderEditor()
  const user = userEvent.setup()

  await user.click(within(group('Dips')).getByRole('button', { name: 'Add set' }))
  await user.click(saveButton())

  expect(await savedDraft(onSave)).toEqual({
    ...finished(),
    entries: [dips1, entry('dips', 2, null, 10, END), squat1, squat2, squat3],
  })
})

test('O14 SessionEditor adds a Set after a delete at the renumbered next setIndex', async () => {
  const { onSave } = renderEditor()
  const user = userEvent.setup()

  await user.click(within(group('Back squat')).getByRole('button', { name: 'Delete set 3' }))
  await user.click(within(group('Back squat')).getByRole('button', { name: 'Add set' }))
  await user.click(saveButton())

  expect(await savedDraft(onSave)).toEqual({
    ...finished(),
    entries: [dips1, squat1, squat2, entry('squat', 3, 62.5, 6, END)],
  })
})

test('O14 SessionEditor saves changed start and end times as the local date-times entered', async () => {
  const { onSave } = renderEditor()

  fireEvent.change(startField(), { target: { value: '2023-11-14T17:45' } })
  fireEvent.change(endField(), { target: { value: '2023-11-14T19:30' } })
  await userEvent.setup().click(saveButton())

  expect(await savedDraft(onSave)).toEqual({
    ...finished(),
    entries: ordered(finished().entries),
    startedAt: new Date(2023, 10, 14, 17, 45).getTime(),
    finishedAt: new Date(2023, 10, 14, 19, 30).getTime(),
  })
})

test('O14 SessionEditor Cancel calls onCancel and never onSave', async () => {
  const { onSave, onCancel } = renderEditor()
  const user = userEvent.setup()

  await user.click(within(group('Back squat')).getByRole('button', { name: 'Delete set 2' }))
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(onCancel).toHaveBeenCalledTimes(1)
  expect(onSave).not.toHaveBeenCalled()
})

test('O14 SessionEditor shows a rejected save\'s message and keeps the draft', async () => {
  const onSave = vi.fn().mockRejectedValue(new Error('the workout could not be saved'))
  renderEditor(finished(), onSave)
  const user = userEvent.setup()

  await user.click(within(group('Back squat')).getByRole('button', { name: 'Delete set 1' }))
  await user.click(saveButton())

  expect(await screen.findByRole('alert')).toHaveTextContent('the workout could not be saved')
  expect(within(group('Back squat')).queryByText('60 × 8')).toBeNull()
  expect(within(group('Back squat')).getByText('62.5 × 6')).toBeVisible()
  expect(saveButton()).toBeEnabled()
})

// --- O15: a draft Save refuses ------------------------------------------------------------------

test('O15 SessionEditor with the end before the start shows the times line and disables Save', async () => {
  const { onSave } = renderEditor()

  fireEvent.change(endField(), { target: { value: '2023-11-14T17:30' } })

  expect(screen.getByText('End time must be after the start time.')).toBeVisible()
  expect(saveButton()).toBeDisabled()
  await userEvent.setup().click(saveButton())
  expect(onSave).not.toHaveBeenCalled()
})

test('O15 SessionEditor clears the times line and enables Save once the end is after the start again', () => {
  renderEditor()

  fireEvent.change(endField(), { target: { value: '2023-11-14T17:30' } })
  fireEvent.change(endField(), { target: { value: '2023-11-14T18:30' } })

  expect(screen.queryByText('End time must be after the start time.')).toBeNull()
  expect(saveButton()).toBeEnabled()
})

test('O15 SessionEditor with every Set deleted shows the no-sets line and disables Save', async () => {
  const { onSave } = renderEditor(finished([squat1, dips1]))
  const user = userEvent.setup()

  await user.click(within(group('Back squat')).getByRole('button', { name: 'Delete set 1' }))
  expect(saveButton()).toBeEnabled()
  await user.click(within(screen.getByRole('group', { name: 'Dips' })).getByRole('button', { name: 'Delete set 1' }))

  expect(
    screen.getByText('A workout needs at least one set. Delete the workout instead.'),
  ).toBeVisible()
  expect(saveButton()).toBeDisabled()
  await user.click(saveButton())
  expect(onSave).not.toHaveBeenCalled()
})

// --- E12-T7 O16: Delete workout -----------------------------------------------------------------

function renderEditorWithDelete(): { onDelete: Mock; onSave: Mock } {
  const onDelete = vi.fn()
  const onSave = vi.fn().mockResolvedValue(undefined)
  render(
    <SessionEditor
      session={finished()}
      workoutName="Upper A"
      resolve={resolve}
      onSave={onSave}
      onCancel={vi.fn()}
      onDelete={onDelete}
    />,
  )
  return { onDelete, onSave }
}

test('O16 SessionEditor Delete workout asks to confirm inline and does not delete until confirmed', async () => {
  const { onDelete } = renderEditorWithDelete()
  const user = userEvent.setup()

  await user.click(screen.getByRole('button', { name: 'Delete workout' }))

  expect(screen.getByRole('button', { name: 'Confirm' })).toBeVisible()
  expect(onDelete).not.toHaveBeenCalled()

  await user.click(screen.getByRole('button', { name: 'Confirm' }))

  expect(onDelete).toHaveBeenCalledTimes(1)
})

test('O16 SessionEditor without onDelete shows no Delete workout', () => {
  renderEditor()

  expect(screen.queryByRole('button', { name: 'Delete workout' })).toBeNull()
})
