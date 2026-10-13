import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { loadCatalog } from '../data/catalog'
import { ExerciseHistoryOverlay } from './ExerciseHistoryOverlay'
import type { Exercise, ExercisePlan, Session, SetEntry } from '../types'

// E16-T7 O21: the History overlay over hand-built Sessions. Dates are noon UTC so the weekday
// reads the same in every timezone: 2026-10-06 is a Tuesday, 2026-09-28 a Monday.

const squat = loadCatalog().get('back-squat') as Exercise
const plan: ExercisePlan = { exerciseId: 'back-squat', sets: 4, repRange: [8, 12], restSeconds: 180 }

const TUE_6_OCT = Date.UTC(2026, 9, 6, 12)
const MON_28_SEP = Date.UTC(2026, 8, 28, 12)

function set(
  setIndex: number,
  weightKg: number,
  reps: number,
  at: number,
  extra: Partial<SetEntry> = {},
): SetEntry {
  return { exerciseId: 'back-squat', setIndex, weightKg, reps, loggedAt: at + setIndex, ...extra }
}

function session(id: string, startedAt: number, entries: SetEntry[], finished = true): Session {
  return {
    id,
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt,
    finishedAt: finished ? startedAt + 3600_000 : null,
    entries,
  }
}

const older = session('older', MON_28_SEP, [set(1, 60, 8, MON_28_SEP), set(2, 60, 8, MON_28_SEP)])
const newer = session('newer', TUE_6_OCT, [
  set(1, 80, 8, TUE_6_OCT),
  set(2, 80, 8, TUE_6_OCT),
  set(3, 80, 7, TUE_6_OCT),
])

function open(sessions: Session[], onClose = () => {}) {
  render(<ExerciseHistoryOverlay exercise={squat} sessions={sessions} plan={plan} onClose={onClose} />)
  return screen.getByRole('dialog', { name: 'History · Back squat' })
}

test('O21 the overlay is headed History · <Exercise>', () => {
  open([newer])

  expect(screen.getByRole('dialog', { name: 'History · Back squat' })).toBeVisible()
})

test('O21 each Session shows its date as Tue 6 Oct and its Sets as the Last time line writes them', () => {
  const dialog = open([newer])

  expect(within(dialog).getByText('Tue 6 Oct')).toBeVisible()
  expect(within(dialog).getByText('80×8 · 80×8 · 80×7')).toBeVisible()
})

test('O21 Sessions are listed newest first whatever order they arrive in', () => {
  const dialog = open([older, newer])

  const dates = within(dialog)
    .getAllByText(/^(Mon 28 Sep|Tue 6 Oct)$/)
    .map((el) => el.textContent)
  expect(dates).toEqual(['Tue 6 Oct', 'Mon 28 Sep'])
})

test('O21 an unfinished Session and a Session without this Exercise are not listed', () => {
  const unfinished = session('open', Date.UTC(2026, 9, 7, 12), [set(1, 90, 5, 0)], false)
  const other = session('other', Date.UTC(2026, 9, 8, 12), [
    { exerciseId: 'lunges', setIndex: 1, weightKg: 30, reps: 10, loggedAt: 1 },
  ])
  const dialog = open([newer, unfinished, other])

  expect(within(dialog).getByText('Tue 6 Oct')).toBeVisible()
  expect(within(dialog).queryByText(/Wed 7 Oct|Thu 8 Oct/)).toBeNull()
  expect(within(dialog).queryByText(/90×5/)).toBeNull()
  expect(within(dialog).queryByText(/30×10/)).toBeNull()
})

test('O21 a Set of another kind carries its kind marker', () => {
  const kinded = session('kinded', TUE_6_OCT, [
    set(1, 40, 5, TUE_6_OCT, { kind: 'warmup' }),
    set(2, 80, 8, TUE_6_OCT),
  ])
  const dialog = open([kinded])

  expect(within(dialog).getByText('W')).toBeVisible()
  expect(within(dialog).queryByText('D')).toBeNull()
})

test('O21 a record Set carries the PR badge and the older Session does not', () => {
  // 80 kg beats the 60 kg logged before it; the older Session has nothing earlier to beat.
  const dialog = open([older, newer])

  expect(within(dialog).getAllByLabelText('Personal record')).toHaveLength(1)
  const newerRow = within(dialog).getByText('Tue 6 Oct').closest('li') as HTMLElement
  expect(within(newerRow).getByLabelText('Personal record')).toBeVisible()
})

test('O21 with no finished Session of this Exercise the overlay reads No earlier Sessions', () => {
  const dialog = open([session('open', TUE_6_OCT, [set(1, 80, 8, TUE_6_OCT)], false)])

  expect(within(dialog).getByText('No earlier Sessions')).toBeVisible()
  expect(within(dialog).queryByText('Tue 6 Oct')).toBeNull()
})

test('O21 the overlay is read-only: Close is its only button, and it calls onClose', async () => {
  const onClose = vi.fn()
  const dialog = open([older, newer], onClose)

  const names = within(dialog)
    .getAllByRole('button')
    .map((b) => b.textContent)
  expect(names).toEqual(['Close'])
  await userEvent.setup().click(within(dialog).getByRole('button', { name: 'Close' }))
  expect(onClose).toHaveBeenCalledTimes(1)
})
