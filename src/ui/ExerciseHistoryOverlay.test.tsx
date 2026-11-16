import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { loadCatalog } from '../data/catalog'
import { ExerciseHistoryOverlay } from './ExerciseHistoryOverlay'
import type { Exercise, ExercisePlan, Session, SetEntry } from '../types'

// E16-T7 O21, v6 §6.3: Lift history from the tools sheet is the one Lift page in a sheet, over
// hand-built Sessions. Dates are noon UTC so the weekday reads the same in every timezone:
// 2026-10-06 is a Tuesday, 2026-09-28 a Monday.

const squat = loadCatalog().get('back-squat') as Exercise
const plan: ExercisePlan = { exerciseId: 'back-squat', sets: 4, repRange: [8, 12], restSeconds: 180 }

const TUE_6_OCT = Date.UTC(2026, 9, 6, 12)
const MON_28_SEP = Date.UTC(2026, 8, 28, 12)
const NOW = Date.UTC(2026, 9, 7, 12)

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
  render(<ExerciseHistoryOverlay exercise={squat} sessions={sessions} plan={plan} onClose={onClose} now={NOW} />)
  return screen.getByRole('dialog', { name: 'Back squat' })
}

/** The log row of `date`: its sets line's text. */
function setsOf(dialog: HTMLElement, date: string): string {
  const log = within(dialog).getByRole('list', { name: 'Sessions' })
  const row = within(log).getByText(date).closest('li') as HTMLElement
  return row.querySelector('.lift-log-sets')?.textContent ?? ''
}

test('O21 the overlay is headed History · <Exercise>', () => {
  // v6: the sheet is headed by the lift's name, as the Progress Lift page is.
  open([newer])

  expect(screen.getByRole('dialog', { name: 'Back squat' })).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Back squat' })).toBeVisible()
})

test('O21 each Session shows its date as Tue 6 Oct and its Sets as the Last time line writes them', () => {
  const dialog = open([newer])

  expect(within(within(dialog).getByRole('list', { name: 'Sessions' })).getByText('Tue 6 Oct')).toBeVisible()
  // v7: repeated Sets at one load share one figure (study §3 Numerals).
  expect(setsOf(dialog, 'Tue 6 Oct')).toBe('80×8 · 8 · 7')
})

test('O21 Sessions are listed newest first whatever order they arrive in', () => {
  const dialog = open([older, newer])

  const log = within(dialog).getByRole('list', { name: 'Sessions' })
  const dates = within(log)
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

  expect(within(dialog).getAllByText('Tue 6 Oct')[0]).toBeVisible()
  expect(within(dialog).queryByText(/Wed 7 Oct|Thu 8 Oct/)).toBeNull()
  expect(dialog.textContent).not.toMatch(/90×5|30×10/)
})

test('O21 a Set of another kind carries its kind marker', () => {
  // v6: warm-ups sit on their own muted line, prefixed W; a failure Set carries its F.
  const kinded = session('kinded', TUE_6_OCT, [
    set(1, 40, 5, TUE_6_OCT, { kind: 'warmup' }),
    set(2, 80, 8, TUE_6_OCT),
    set(3, 80, 9, TUE_6_OCT, { kind: 'failure' }),
  ])
  const dialog = open([kinded])

  expect(within(dialog).getByText('W 40×5')).toBeVisible()
  expect(setsOf(dialog, 'Tue 6 Oct')).toBe('80×8 · 80×9 F')
  expect(within(dialog).queryByText(/ D$/)).toBeNull()
})

test('O21 a record Set carries the PR badge and the older Session does not', () => {
  // 80 kg beats the 60 kg logged before it; the older Session has nothing earlier to beat. The
  // tag sits on the Set that set it.
  const dialog = open([older, newer])

  expect(within(dialog).getAllByLabelText(/^Personal record/)).toHaveLength(1)
  const tag = within(dialog).getByLabelText('Personal record, heaviest weight')
  expect(tag).toHaveClass('tag', 'tag-pr')
  expect(tag.textContent).toBe('PR')
  // v7: the PR Set ends its run, so the tag follows the Set that earned it.
  expect(setsOf(dialog, 'Tue 6 Oct')).toBe('80×8 PR · 80×8 · 7')
  expect(setsOf(dialog, 'Mon 28 Sep')).toBe('60×8 · 8')
})

test('O21 with no finished Session of this Exercise the overlay reads No earlier Sessions', () => {
  const dialog = open([session('open', TUE_6_OCT, [set(1, 80, 8, TUE_6_OCT)], false)])

  expect(within(dialog).getByText(/No sessions of this lift yet/)).toBeVisible()
  expect(within(dialog).queryByText('Tue 6 Oct')).toBeNull()
})

test('O21 the overlay is read-only: Close is its only button, and it calls onClose', async () => {
  const onClose = vi.fn()
  const dialog = open([older, newer], onClose)

  // v6: "Done" closes it; the other controls only read (Why?, the chart's points, its tabs).
  const names = within(dialog)
    .getAllByRole('button')
    .map((b) => b.getAttribute('aria-label') ?? b.textContent)
  expect(names[0]).toBe('Done')
  expect(names.join(' ')).not.toMatch(/Edit|Delete|Remove/)
  await userEvent.setup().click(within(dialog).getByRole('button', { name: 'Done' }))
  expect(onClose).toHaveBeenCalledTimes(1)
})

// v7: one chart -- est. strength by default, the top-set weight on its chip.

const WEEK = 7 * 24 * 3600_000

test('v5 the history leads with the latest estimated max and the set behind it', () => {
  // v7: it leads with the lift's status, then its est. strength (80 × 8 -> 101.3 kg) and how far
  // it moved since 28 Sep (60 × 8 -> 76 kg), defined in one line; the log follows the chart.
  const dialog = open([older, newer])

  const hero = within(dialog).getByRole('region', { name: 'Est. strength' })
  expect(hero.querySelector('.lift-hero-value')?.textContent).toBe('101.3 kg')
  expect(within(hero).getByText('↑ +25.3 since 28 Sep')).toBeVisible()
  expect(within(hero).getByText('Est. strength: the one-rep max your best set predicts')).toBeVisible()
  expect(within(dialog).queryByText(/Epley/)).toBeNull()
  const list = within(dialog).getByRole('list', { name: 'Sessions' })
  expect(hero.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('v5 the chart is named by where the lift went, and marks new bests', async () => {
  const dialog = open([older, newer])

  // 60 x 8 -> 76 kg on 28 Sep, 80 x 8 -> 101.3 kg on 6 Oct; the record day wears the gold ring.
  const chart = within(dialog).getByRole('img', { name: 'Estimated strength, 76 on 28 Sep to 101.3 on 6 Oct' })
  expect(chart.querySelectorAll('circle[data-record]')).toHaveLength(1)
  expect(chart.querySelector('.lift-chart-pr')?.textContent).toBe('PR 101.3')
  await userEvent.setup().click(within(within(dialog).getByRole('radiogroup', { name: 'Show' })).getByRole('radio', { name: 'Top set' }))
  expect(within(dialog).getByRole('img', { name: 'Top-set weight, 60 on 28 Sep to 80 on 6 Oct' })).toBeVisible()
})

test('v5 tapping a point reads its date, value and best set', async () => {
  const dialog = open([older, newer])

  await userEvent.setup().click(within(dialog).getByRole('button', { name: 'Mon 28 Sep · 76 kg est. strength · 60 kg × 8, 8' }))

  const readout = within(dialog).getByRole('region', { name: 'Chart readout' })
  expect(readout.textContent).toContain('Mon 28 Sep')
  expect(readout.textContent).toContain('76 kg est. strength · 60 kg × 8, 8')
})

test('v5 one Session shows its value but no chart yet', () => {
  const dialog = open([newer])

  const hero = within(dialog).getByRole('region', { name: 'Est. strength' })
  expect(hero.querySelector('.lift-hero-value')?.textContent).toBe('101.3 kg')
  expect(within(dialog).queryByRole('img')).toBeNull()
  expect(within(dialog).getByText(/One session in this range/)).toBeVisible()
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
