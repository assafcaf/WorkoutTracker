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
  const tag = within(newerRow).getByLabelText('Personal record')
  expect(tag).toHaveClass('tag', 'tag-pr')
  expect(tag.textContent).toBe('PR')
  expect(dialog.querySelector('.pr-badge')).toBeNull()
})

test('O21 with no finished Session of this Exercise the overlay reads No earlier Sessions', () => {
  const dialog = open([session('open', TUE_6_OCT, [set(1, 80, 8, TUE_6_OCT)], false)])

  expect(within(dialog).getByText('No earlier Sessions')).toBeVisible()
  expect(within(dialog).queryByText('Tue 6 Oct')).toBeNull()
})

test('O21 the overlay is read-only: Close is its only button, and it calls onClose', async () => {
  const onClose = vi.fn()
  const dialog = open([older, newer], onClose)

  // v5: the chart's points are buttons too, but they only read a Session out; nothing edits.
  const names = within(dialog)
    .getAllByRole('button')
    .map((b) => b.getAttribute('aria-label') ?? b.textContent)
  expect(names[0]).toBe('Close')
  expect(names.slice(1)).toHaveLength(2)
  for (const name of names.slice(1)) expect(name).toMatch(/^\d+ \w{3} · .* kg · Best set /)
  expect(names.join(' ')).not.toMatch(/Edit|Delete|Remove/)
  await userEvent.setup().click(within(dialog).getByRole('button', { name: 'Close' }))
  expect(onClose).toHaveBeenCalledTimes(1)
})

// v5: the history leads with a graph that folds weight and reps into one number per Session.

const WEEK = 7 * 24 * 3600_000

test('v5 the history leads with the latest estimated max and the set behind it', () => {
  const dialog = open([older, newer])

  const trend = within(dialog).getByRole('region', { name: 'Trend' })
  // 80 x 8 -> Epley 101.3 kg; the latest Session's best set.
  expect(within(trend).getByText('101.3 kg')).toBeVisible()
  expect(within(trend).getByText('80 × 8 · Tue 6 Oct')).toBeVisible()
  expect(within(trend).getByText(/Estimated max \(Epley\)/)).toBeVisible()
  // It comes before the log.
  const list = within(dialog).getByRole('list', { name: 'Sessions' })
  expect(trend.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('v5 the chart is named by where the lift went, and marks new bests', () => {
  const dialog = open([older, newer])

  // 60 x 8 -> 76.0 on 28 Sep, 80 x 8 -> 101.3 on 6 Oct.
  const chart = within(dialog).getByRole('img', { name: 'Estimated max up 25.3 kg over 8 days' })
  expect(within(dialog).getByText('Estimated max up 25.3 kg over 8 days')).toBeVisible()
  expect(chart.querySelectorAll('circle[data-record]')).toHaveLength(1)
})

test('v5 tapping a point reads its date, value and best set', async () => {
  const dialog = open([older, newer])

  await userEvent.setup().click(within(dialog).getByRole('button', { name: /^28 Sep · 76 kg · Best set 60 × 8$/ }))

  const readout = within(dialog).getByRole('region', { name: 'Chart readout' })
  expect(readout.textContent).toContain('28 Sep')
  expect(readout.textContent).toContain('Best set 60 × 8')
})

test('v5 one Session shows its value but no chart yet', () => {
  const dialog = open([newer])

  expect(within(dialog).getByText('101.3 kg')).toBeVisible()
  expect(within(dialog).queryByRole('img')).toBeNull()
  expect(within(dialog).getByText(/One session so far/)).toBeVisible()
})

test('v5 the log under the chart shows the latest 4 Sessions and Show all opens the rest', async () => {
  const many = Array.from({ length: 6 }, (_, i) =>
    session('s' + i, MON_28_SEP - (5 - i) * WEEK, [set(1, 60 + i * 2.5, 8, MON_28_SEP - (5 - i) * WEEK)]),
  )
  const dialog = open(many)

  const list = within(dialog).getByRole('list', { name: 'Sessions' })
  expect(list.querySelectorAll('li')).toHaveLength(4)
  await userEvent.setup().click(within(dialog).getByRole('button', { name: 'Show all 6 sessions' }))
  expect(list.querySelectorAll('li')).toHaveLength(6)
  expect(within(dialog).queryByRole('button', { name: /Show all/ })).toBeNull()
})
