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
  },
  {
    id: 'dips',
    libraryId: 'Dips',
    name: 'Dips',
    weightStep: 2.5,
    startWeight: null,
    bodyweight: true,
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


/**
 * v7: a Set row writes its Set through SetFigure (src/ui/figures), whose `×` sits in its own span,
 * so a row's Set is found by its figure: `setFigure('60 × 8')` matches the `.set-figure` reading
 * `60×8` (the spaces around the × are drawn by CSS).
 */
function setFigure(text: string): (content: string, element: Element | null) => boolean {
  return (_content, element) =>
    element !== null && element.classList.contains('set-figure') && element.textContent === text.replace(/ /g, '')
}

test('O13 SessionEditor shows the Workout name as its heading', () => {
  renderEditor()

  // V6-14: one header names what the screen does, the Workout and the day.
  expect(screen.getByRole('heading', { name: 'Edit · Upper A · 14 Nov 2023' })).toBeVisible()
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
  expect(within(squat).getByText(setFigure('60 × 8'))).toBeVisible()
  expect(within(squat).getByText(setFigure('62.5 × 6'))).toBeVisible()
  expect(within(squat).getByText(setFigure('65 × 5'))).toBeVisible()
  for (const setIndex of [1, 2, 3]) {
    expect(within(squat).getByRole('button', { name: new RegExp(`^Edit Back squat set ${setIndex},`) })).toBeVisible()
    expect(within(squat).getByRole('button', { name: new RegExp(`^Delete Back squat set ${setIndex},`) })).toBeVisible()
  }
  expect(within(squat).queryByRole('button', { name: /^Edit Back squat set 4,/ })).toBeNull()

  const dips = group('Dips')
  expect(within(dips).getByText(setFigure('BW × 10'))).toBeVisible()
  expect(within(dips).getByRole('button', { name: 'Edit Dips set 1, BW × 10' })).toBeVisible()
  expect(within(dips).getByRole('button', { name: 'Delete Dips set 1, BW × 10' })).toBeVisible()
  expect(within(dips).queryByText(setFigure('60 × 8'))).toBeNull()
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

  await user.click(within(group('Back squat')).getByRole('button', { name: /^Edit Back squat set 1,/ }))
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

  await user.click(within(group('Back squat')).getByRole('button', { name: /^Delete Back squat set 1,/ }))
  expect(within(group('Back squat')).queryByText(setFigure('60 × 8'))).toBeNull()
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

  await user.click(within(group('Back squat')).getByRole('button', { name: /^Delete Back squat set 3,/ }))
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

  await user.click(within(group('Back squat')).getByRole('button', { name: /^Delete Back squat set 2,/ }))
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(onCancel).toHaveBeenCalledTimes(1)
  expect(onSave).not.toHaveBeenCalled()
})

test('O14 SessionEditor shows a rejected save\'s message and keeps the draft', async () => {
  const onSave = vi.fn().mockRejectedValue(new Error('the workout could not be saved'))
  renderEditor(finished(), onSave)
  const user = userEvent.setup()

  await user.click(within(group('Back squat')).getByRole('button', { name: /^Delete Back squat set 1,/ }))
  await user.click(saveButton())

  expect(await screen.findByRole('alert')).toHaveTextContent('the workout could not be saved')
  expect(within(group('Back squat')).queryByText(setFigure('60 × 8'))).toBeNull()
  expect(within(group('Back squat')).getByText(setFigure('62.5 × 6'))).toBeVisible()
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

  await user.click(within(group('Back squat')).getByRole('button', { name: /^Delete Back squat set 1,/ }))
  expect(saveButton()).toBeEnabled()
  await user.click(within(screen.getByRole('group', { name: 'Dips' })).getByRole('button', { name: /^Delete Dips set 1,/ }))

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

// --- E14-T4: the Session note in the editor --------------------------------------------------

test('O12 SessionEditor shows the Session note and saves an edited one in the single write', async () => {
  const { onSave } = renderEditor({ ...finished(), note: 'Old note' })
  const user = userEvent.setup()
  expect(screen.getByLabelText('Note')).toHaveValue('Old note')

  await user.clear(screen.getByLabelText('Note'))
  await user.type(screen.getByLabelText('Note'), 'New note')
  await user.click(saveButton())

  const draft = await savedDraft(onSave)
  expect(draft.note).toBe('New note')
  expect(onSave).toHaveBeenCalledTimes(1)
})

test('O12 SessionEditor adds a note to a Session that had none', async () => {
  const { onSave } = renderEditor()
  const user = userEvent.setup()

  await user.type(screen.getByLabelText('Note'), 'Fresh')
  await user.click(saveButton())

  expect((await savedDraft(onSave)).note).toBe('Fresh')
})

test('O12 SessionEditor saving the note cleared hands over a draft without a note', async () => {
  const { onSave } = renderEditor({ ...finished(), note: 'Old note' })
  const user = userEvent.setup()

  await user.clear(screen.getByLabelText('Note'))
  await user.click(saveButton())

  const draft = await savedDraft(onSave)
  expect(draft.note === undefined || draft.note === '').toBe(true)
})

// --- E17-T7 O11: destructive actions wear btn-danger -------------------------------------------
const BUTTON_ROLES = ['btn-primary', 'btn-secondary', 'btn-quiet', 'btn-danger', 'tab', 'key', 'chip', 'cell', 'icon-btn']

/** The control-table roles a button wears (E17-T7 O10/O11). */
function rolesOf(button: HTMLElement): string[] {
  return [...button.classList].filter((name) => BUTTON_ROLES.includes(name))
}

test('E17 O11 SessionEditor Delete set wears btn-danger and no other role', () => {
  renderEditor()

  expect(
    rolesOf(within(group('Back squat')).getByRole('button', { name: /^Delete Back squat set 1,/ })),
  ).toEqual(['btn-danger'])
})

// --- V2-10 / V1-24: the Deload session switch lives here, and the editor opens at its top ------

test('V2-10 SessionEditor carries the Deload session switch, reflecting the Session', () => {
  renderEditor({ ...finished(), deload: true })

  expect(screen.getByRole('switch', { name: 'Deload session' })).toBeChecked()
})

test('V2-10 SessionEditor saves the Deload session mark with the draft', async () => {
  const { onSave } = renderEditor()
  const user = userEvent.setup()

  await user.click(screen.getByRole('switch', { name: 'Deload session' }))
  await user.click(saveButton())

  expect((await savedDraft(onSave)).deload).toBe(true)
})

test('V2-10 SessionEditor turning Deload session off saves a draft without the mark', async () => {
  const { onSave } = renderEditor({ ...finished(), deload: true })
  const user = userEvent.setup()

  await user.click(screen.getByRole('switch', { name: 'Deload session' }))
  await user.click(saveButton())

  expect('deload' in (await savedDraft(onSave))).toBe(false)
})

// --- V6-14: Set kind and names; V6-13: Add exercise and the Log mode ---------------------------

test('V6-14 a warm-up Set reads "W 40 × 5", the W muted and named Warm-up', () => {
  renderEditor(finished([{ ...entry('squat', 1, 40, 5, START + MINUTE), kind: 'warmup' }, squat2]))

  const squat = group('Back squat')
  const warmUp = within(squat).getAllByRole('listitem')[0]
  expect(warmUp.querySelector('.session-editor-set-values')).toHaveTextContent(/^W\s?40\s?×\s?5$/)
  expect(warmUp.querySelector('.session-editor-set-kind')).toHaveAttribute('aria-hidden', 'true')
  expect(within(squat).getByRole('button', { name: 'Delete Back squat set 1, warm-up 40 × 5' })).toBeVisible()
  expect(within(squat).getByRole('button', { name: 'Delete Back squat set 2, 62.5 × 6' })).toBeVisible()
})

test('V6-14 no two controls in the editor share an accessible name', () => {
  renderEditor()

  const names = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label') ?? button.textContent)
  const repeated = names.filter((name, index) => name !== 'Add set' && names.indexOf(name) !== index)
  expect(repeated).toEqual([])
  expect(screen.getByRole('button', { name: 'Delete Dips set 1, BW × 10' })).toBeVisible()
})

test('V6-13 in Log mode the heading reads "Log · Workout · day"', () => {
  render(
    <SessionEditor
      session={finished()}
      workoutName="Upper A"
      mode="log"
      now={new Date(2023, 10, 20).getTime()}
      resolve={resolve}
      onSave={vi.fn()}
      onCancel={vi.fn()}
    />,
  )

  expect(screen.getByRole('heading', { name: 'Log · Upper A · Tue 14 Nov' })).toBeVisible()
})

test('V6-13 Add exercise picks an Exercise and adds it with one Set, open on the Dials, saved as added', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined)
  render(
    <SessionEditor
      session={finished([squat1])}
      workoutName="Upper A"
      resolve={resolve}
      plannedIds={['squat']}
      addable={[
        { id: 'squat', name: 'Back squat', force: null, level: 'beginner', mechanic: null, equipment: null, primaryMuscles: ['quadriceps'], secondaryMuscles: [], instructions: [], category: 'strength', images: [] },
        { id: 'dips', name: 'Dips', force: null, level: 'beginner', mechanic: null, equipment: null, primaryMuscles: ['chest'], secondaryMuscles: [], instructions: [], category: 'strength', images: [] },
      ]}
      onSave={onSave}
      onCancel={vi.fn()}
    />,
  )
  const user = userEvent.setup()

  await user.click(screen.getByRole('button', { name: 'Add exercise' }))
  const picker = screen.getByRole('dialog', { name: 'Add exercise' })
  // Already in the Session: not offered again.
  expect(within(picker).queryByRole('button', { name: 'Back squat' })).toBeNull()
  await user.click(within(picker).getByRole('button', { name: 'Dips' }))

  expect(screen.queryByRole('dialog', { name: 'Add exercise' })).toBeNull()
  const dips = group('Dips')
  expect(within(dips).getByText(setFigure('BW × 8'))).toBeVisible()
  expect(within(dips).getByRole('button', { name: 'Edit Dips set 1, BW × 8' })).toHaveAttribute('aria-pressed', 'true')

  await user.click(saveButton())
  const draft = await savedDraft(onSave)
  expect(draft.entries.filter((e) => e.exerciseId === 'dips')).toEqual([
    { exerciseId: 'dips', setIndex: 1, weightKg: null, reps: 8, loggedAt: END },
  ])
  expect(draft.added).toEqual([{ exerciseId: 'dips', sets: 3, repRange: [8, 12], restSeconds: 90 }])
})

test('V6-13 without an addable list the editor offers no Add exercise', () => {
  renderEditor()

  expect(screen.queryByRole('button', { name: 'Add exercise' })).toBeNull()
})

test('V1-24 SessionEditor scrolls the window to the top when it opens', () => {
  const scrollTo = vi.fn()
  const before = window.scrollTo
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo
  try {
    renderEditor()
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  } finally {
    window.scrollTo = before
  }
})
