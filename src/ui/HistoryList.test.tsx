import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { HistoryList, summarise } from './HistoryList'
import type { Exercise, Program, Session, SetEntry } from '../types'

// summarise is pure over a session and the programs it is checked against, so these tests need
// no database: they build both by hand. The end-to-end half of O17 -- that a session finished
// through the app appears here -- lives in src/App.test.tsx.

/** A fixed wall-clock base, so every timestamp below is a literal derived by hand. */
const BASE = 1_700_000_000_000

function loadedEntry(exerciseId: string, setIndex: number, weightKg: number, reps: number): SetEntry {
  return { exerciseId, setIndex, weightKg, reps, loggedAt: BASE + setIndex }
}

function bodyweightEntry(exerciseId: string, setIndex: number, reps: number): SetEntry {
  return { exerciseId, setIndex, weightKg: null, reps, loggedAt: BASE + setIndex }
}

const workoutA = {
  id: 'workout-a',
  name: 'Workout A',
  exercises: [],
}

const assaf: Program = {
  id: 'assaf-ab-2026',
  name: 'A/B Split',
  units: 'kg',
  workouts: [workoutA],
  sessionsPerWeek: 3,
}

function sessionWith(entries: SetEntry[]): Session {
  return {
    id: 'session-under-test',
    programId: assaf.id,
    workoutId: workoutA.id,
    startedAt: BASE,
    finishedAt: BASE + 3600_000,
    entries,
  }
}

// --- summarise: the arithmetic -----------------------------------------------------------

test('O17 summarise sums weightKg times reps across loaded entries as totalVolumeKg', () => {
  const session = sessionWith([
    loadedEntry('back-squat', 1, 60, 10),
    loadedEntry('back-squat', 2, 62.5, 8),
  ])

  const summary = summarise(session, [assaf])

  expect(summary.totalVolumeKg).toBe(1100)
})

test('O17 summarise counts a bodyweight entry as 0 kg toward totalVolumeKg instead of throwing', () => {
  const session = sessionWith([
    loadedEntry('back-squat', 1, 60, 10),
    bodyweightEntry('push-ups', 1, 15),
  ])

  const summary = summarise(session, [assaf])

  expect(summary.totalVolumeKg).toBe(600)
})

test('O17 summarise counts totalSets as the number of entries logged', () => {
  const session = sessionWith([
    loadedEntry('back-squat', 1, 60, 10),
    loadedEntry('back-squat', 2, 60, 10),
    bodyweightEntry('push-ups', 1, 15),
  ])

  const summary = summarise(session, [assaf])

  expect(summary.totalSets).toBe(3)
})

test('O17 summarise resolves the programName and workoutName from the given programs', () => {
  const session = sessionWith([loadedEntry('back-squat', 1, 60, 10)])

  const summary = summarise(session, [assaf])

  expect([summary.programName, summary.workoutName]).toEqual(['A/B Split', 'Workout A'])
})

test('O17 summarise uses the session startedAt as its date', () => {
  const session = sessionWith([loadedEntry('back-squat', 1, 60, 10)])

  const summary = summarise(session, [assaf])

  expect(summary.date).toBe(BASE)
})

test('O17 summarise falls back to the session stored programId and workoutId when its program no longer exists', () => {
  const session: Session = {
    id: 'orphan-session',
    programId: 'retired-program',
    workoutId: 'retired-workout',
    startedAt: BASE,
    finishedAt: BASE + 3600_000,
    entries: [loadedEntry('back-squat', 1, 60, 10)],
  }

  const summary = summarise(session, [assaf])

  expect([summary.programName, summary.workoutName]).toEqual(['retired-program', 'retired-workout'])
})

// --- HistoryList: the rendered row --------------------------------------------------------

test('O17 HistoryList shows a finished session date, program name, workout name, total sets and total volume in kg', () => {
  const session = sessionWith([
    loadedEntry('back-squat', 1, 60, 10),
    bodyweightEntry('push-ups', 1, 15),
  ])

  render(<HistoryList sessions={[session]} programs={[assaf]} resolve={() => undefined} />)

  const [row] = screen.getAllByRole('listitem')
  expect(within(row).getByText('2023-11-14')).toBeVisible()
  expect(within(row).getByText('A/B Split')).toBeVisible()
  expect(within(row).getByText('Workout A')).toBeVisible()
  expect(within(row).getByText('2 sets')).toBeVisible()
  expect(within(row).getByText('600 kg')).toBeVisible()
})

// --- O21: the empty state ------------------------------------------------------------------

test('O21 HistoryList shows an empty-state message when there are no finished sessions', () => {
  render(<HistoryList sessions={[]} programs={[assaf]} resolve={() => undefined} />)

  expect(
    screen.getByText('No finished workouts yet. Finish one and it appears here.'),
  ).toBeVisible()
  expect(screen.queryAllByRole('listitem')).toHaveLength(0)
})

// --- S11: a swapped-in exercise's sets read under its own name --------------------------------

/** Resolves `Hammer_Curls` (a library id swapped in for the planned catalog exercise) and
 * `back-squat` (a real catalog id) to their `Exercise` names, the way `resolveExercise` (E5-T6)
 * would -- built by hand here so this test needs no database or real catalog/library. */
function resolveFixture(id: string): Exercise | undefined {
  if (id === 'Hammer_Curls') {
    return {
      id: 'Hammer_Curls',
      libraryId: 'Hammer_Curls',
      name: 'Hammer Curls',
      weightStep: 2.5,
      startWeight: null,
      bodyweight: false,
      invertProgress: false,
    }
  }
  if (id === 'back-squat') {
    return {
      id: 'back-squat',
      libraryId: 'Barbell_Squat',
      name: 'Back Squat',
      weightStep: 2.5,
      startWeight: null,
      bodyweight: false,
      invertProgress: false,
    }
  }
  return undefined
}

/** The card's own toggle: the one button that carries `aria-expanded`. */
function cardToggle(): HTMLElement {
  return screen.getByRole('button', { expanded: false })
}

test('S11 HistoryList groups a session\'s sets by exercise, headed by the resolved name, so swapped-in Hammer_Curls sets list under "Hammer Curls"', async () => {
  const session = sessionWith([
    loadedEntry('Hammer_Curls', 1, 12, 12),
    loadedEntry('Hammer_Curls', 2, 12, 10),
    loadedEntry('back-squat', 1, 60, 10),
  ])

  render(<HistoryList sessions={[session]} programs={[assaf]} resolve={resolveFixture} />)
  await userEvent.setup().click(cardToggle())

  const hammerHeading = screen.getByRole('heading', { name: 'Hammer Curls', exact: true })
  const hammerGroup = hammerHeading.closest('li')
  if (!hammerGroup) throw new Error('the "Hammer Curls" heading is not inside a group list item')

  expect(within(hammerGroup).getByText('12 × 12')).toBeVisible()
  expect(within(hammerGroup).getByText('12 × 10')).toBeVisible()
  expect(within(hammerGroup).getAllByText(/ × /)).toHaveLength(2)

  const squatHeading = screen.getByRole('heading', { name: 'Back Squat', exact: true })
  const squatGroup = squatHeading.closest('li')
  if (!squatGroup) throw new Error('the "Back Squat" heading is not inside a group list item')

  expect(within(squatGroup).getByText('60 × 10')).toBeVisible()

  // The back-squat set stays under its own group, not mixed into the Hammer Curls one.
  expect(within(hammerGroup).queryByText(/60/)).not.toBeInTheDocument()
})

// --- E12-T6: Edit workout opens the History editor ----------------------------------------

test('O13 HistoryList with onEdit renders Edit workout on the row, and tapping it calls onEdit with the session id', async () => {
  const onEdit = vi.fn()
  render(
    <HistoryList
      sessions={[sessionWith([loadedEntry('back-squat', 1, 60, 8)])]}
      programs={[assaf]}
      resolve={resolveFixture}
      onOpen={() => {}}
      onEdit={onEdit}
    />,
  )

  const user = userEvent.setup()
  await user.click(cardToggle())
  const row = screen.getByRole('listitem')
  expect(within(row).getByRole('button', { name: 'Open session' })).toBeVisible()
  await user.click(within(row).getByRole('button', { name: 'Edit workout' }))

  expect(onEdit).toHaveBeenCalledTimes(1)
  expect(onEdit.mock.calls[0][0]).toBe('session-under-test')
  expect(onEdit.mock.calls[0][1]).toBeUndefined()
})

// --- E12-T9: History as collapsible Session cards -------------------------------------------

/** Back squat 60 x 10 and 62.5 x 8, then a bodyweight Push-ups 15 -- 3 Sets over 1 hour. */
function mixedSession(): Session {
  return sessionWith([
    loadedEntry('back-squat', 1, 60, 10),
    loadedEntry('back-squat', 2, 62.5, 8),
    bodyweightEntry('push-ups', 1, 15),
  ])
}

function renderCard(handlers: { onOpen?: (id: string) => void; onEdit?: (id: string, exerciseId?: string) => void } = {}) {
  return render(
    <HistoryList
      sessions={[mixedSession()]}
      programs={[assaf]}
      resolve={resolveFixture}
      onOpen={handlers.onOpen}
      onEdit={handlers.onEdit}
    />,
  )
}

test('O18 a finished Session is a collapsed card showing its date, Workout, duration and Set count, with no Sets listed', () => {
  renderCard({ onOpen: () => {}, onEdit: () => {} })

  const row = screen.getByRole('listitem')
  expect(within(row).getByText('2023-11-14')).toBeVisible()
  expect(within(row).getByText('Workout A')).toBeVisible()
  expect(within(row).getByText('60 min')).toBeVisible()
  expect(within(row).getByText('3 sets')).toBeVisible()
  expect(cardToggle()).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByText(/ × /)).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Back Squat' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Edit workout' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Open session' })).toBeNull()
})

test('O18 tapping a card expands it to every Exercise with its Sets as 80 x 8 and BW x 8, and tapping again collapses it', async () => {
  renderCard()
  const user = userEvent.setup()

  await user.click(cardToggle())

  const squat = screen.getByRole('heading', { name: 'Back Squat' }).closest('li') as HTMLElement
  expect(within(squat).getByText('60 × 10')).toBeVisible()
  expect(within(squat).getByText('62.5 × 8')).toBeVisible()
  // push-ups does not resolve, so its group reads under its id; its Set is bodyweight.
  const pushUps = screen.getByRole('heading', { name: 'push-ups' }).closest('li') as HTMLElement
  expect(within(pushUps).getByText('BW × 15')).toBeVisible()
  const toggle = screen.getByRole('button', { expanded: true })
  expect(toggle).toHaveAttribute('aria-expanded', 'true')

  await user.click(toggle)

  expect(screen.queryByText(/ × /)).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Back Squat' })).toBeNull()
  expect(cardToggle()).toHaveAttribute('aria-expanded', 'false')
})

test('O18 expanding one card leaves the other Session card collapsed', async () => {
  const other: Session = { ...mixedSession(), id: 'other-session', startedAt: BASE - 86_400_000, finishedAt: BASE - 86_400_000 + 1_800_000 }
  render(<HistoryList sessions={[mixedSession(), other]} programs={[assaf]} resolve={resolveFixture} />)

  await userEvent.setup().click(screen.getAllByRole('button', { expanded: false })[0])

  expect(screen.getAllByRole('heading', { name: 'Back Squat' })).toHaveLength(1)
  expect(screen.getAllByRole('button', { expanded: false })).toHaveLength(1)
})

test('O18 each Exercise in an expanded card has its own Edit that calls onEdit with the Session id and that Exercise id', async () => {
  const onEdit = vi.fn()
  renderCard({ onEdit })
  const user = userEvent.setup()
  await user.click(cardToggle())

  const pushUps = screen.getByRole('heading', { name: 'push-ups' }).closest('li') as HTMLElement
  await user.click(within(pushUps).getByRole('button', { name: 'Edit' }))
  const squat = screen.getByRole('heading', { name: 'Back Squat' }).closest('li') as HTMLElement
  await user.click(within(squat).getByRole('button', { name: 'Edit' }))

  expect(onEdit.mock.calls).toEqual([
    ['session-under-test', 'push-ups'],
    ['session-under-test', 'back-squat'],
  ])
})

test('O18 Open session sits in the expanded card and calls onOpen with the Session id', async () => {
  const onOpen = vi.fn()
  renderCard({ onOpen, onEdit: () => {} })
  const user = userEvent.setup()
  expect(screen.queryByRole('button', { name: 'Open session' })).toBeNull()
  await user.click(cardToggle())

  await user.click(screen.getByRole('button', { name: 'Open session' }))

  expect(onOpen.mock.calls).toEqual([['session-under-test']])
})

test('O18 the exercise group list items stay role presentation so the Session card is the only listitem', async () => {
  renderCard({ onEdit: () => {} })
  await userEvent.setup().click(cardToggle())

  expect(screen.getAllByRole('listitem')).toHaveLength(1)
})

// --- E14-T4: the Session note on the History card ---------------------------------------------

test('O12 an expanded History card shows the Session note and a collapsed one does not', async () => {
  render(
    <HistoryList
      sessions={[{ ...sessionWith([loadedEntry('back-squat', 1, 60, 10)]), note: 'PR on squat' }]}
      programs={[assaf]}
      resolve={() => undefined}
    />,
  )
  expect(screen.queryByText('PR on squat')).toBeNull()

  await userEvent.setup().click(screen.getByRole('button', { expanded: false }))

  expect(screen.getByText('PR on squat')).toBeVisible()
})

test('O12 an expanded History card of a Session without a note shows no note element', async () => {
  render(
    <HistoryList
      sessions={[sessionWith([loadedEntry('back-squat', 1, 60, 10)])]}
      programs={[assaf]}
      resolve={() => undefined}
    />,
  )

  await userEvent.setup().click(screen.getByRole('button', { expanded: false }))

  expect(screen.queryByText('undefined')).toBeNull()
  expect(document.querySelector('.history-note')).toBeNull()
})
