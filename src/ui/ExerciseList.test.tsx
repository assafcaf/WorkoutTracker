import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import assafJson from '../data/programs/assaf-ab-2026.json'
import exercisesJson from '../data/exercises.json'
import libraryJson from '../data/library/exercises.json'
import { resolveExercise } from '../data/resolve'
import { ExerciseList } from './ExerciseList'
import type { Exercise, LibraryExercise, Program, Session, SetEntry } from '../types'

// The list is pure presentation over a session it is handed, so these tests need no database:
// they feed it the shipped program and catalog and a session built by hand. The end-to-end
// half of O13 -- that the list comes back with the session after the app is closed -- lives in
// src/App.test.tsx.
const assaf = assafJson as unknown as Program
const workoutA = assaf.workouts[0]
const catalog = new Map((exercisesJson as Exercise[]).map((exercise) => [exercise.id, exercise] as const))
// E5-T12's interface correction: `ExerciseList` takes a `resolve` function rather than the
// catalog map directly, since a swapped-in library id is not in the catalog. None of the cases
// below involve a swap, so wrapping the same catalog map is enough here.
const resolve = (id: string): Exercise | undefined => catalog.get(id)

/** A fixed wall-clock base, so every timestamp below is a literal derived by hand. */
const BASE = 1_700_000_000_000

function entry(exerciseId: string, setIndex: number): SetEntry {
  return { exerciseId, setIndex, weightKg: 60, reps: 10, loggedAt: BASE + setIndex }
}

function sessionWith(entries: SetEntry[]): Session {
  return {
    id: 'session-under-test',
    programId: assaf.id,
    workoutId: workoutA.id,
    startedAt: BASE,
    finishedAt: null,
    entries,
  }
}

function renderList(entries: SetEntry[]) {
  const user = userEvent.setup()
  const onOpenSet = vi.fn()
  const onFinish = vi.fn()
  render(
    <ExerciseList
      program={assaf}
      workout={workoutA}
      resolve={resolve}
      session={sessionWith(entries)}
      onOpenSet={onOpenSet}
      onFinish={onFinish}
      lastSwaps={{}}
      onUndoSwap={vi.fn()}
      onApplySwap={vi.fn()}
    />,
  )
  return { user, onOpenSet, onFinish }
}

/** The row an exercise is opened from; its accessible name starts with the exercise's name. */
function row(exerciseName: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^${exerciseName}`) })
}

function precedes(first: Element, second: Element): boolean {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)
}

/** What the row shows as its set progress, whitespace-collapsed: "3/4". */
function progressOf(exerciseName: string): string {
  const shown = within(row(exerciseName)).getByText(/^\d+\s*\/\s*\d+$/)
  return (shown.textContent ?? '').replace(/\s+/g, ' ').trim()
}

test('O13 the exercise list shows an exercise with 3 of its 4 planned sets logged as 3/4', () => {
  renderList([entry('back-squat', 1), entry('back-squat', 2), entry('back-squat', 3)])

  expect(progressOf('Back squat')).toBe('3/4')
})

test('O13 the exercise list shows an exercise with nothing logged as 0/4', () => {
  renderList([])

  expect(progressOf('Back squat')).toBe('0/4')
})

test('O13 the exercise list counts each exercise its own sets, not the session total', () => {
  renderList([
    entry('back-squat', 1),
    entry('back-squat', 2),
    entry('lunges', 1),
    entry('lunges', 2),
    entry('lunges', 3),
  ])

  expect([progressOf('Back squat'), progressOf('Lunges'), progressOf('Push-ups')]).toEqual([
    '2/4',
    '3/3',
    '0/3',
  ])
})

test('O13 the exercise list shows every planned exercise of the workout in plan order', () => {
  renderList([])

  // `row` throws when an exercise is missing or rendered twice, so finding all seven already
  // proves the list is complete; the positions then prove it follows the plan's order.
  const rows = [
    'Back squat',
    'Lunges',
    'DB bench press',
    'Push-ups',
    'Machine shoulder press',
    'Lateral raises',
    'Cable push-down',
  ].map((name) => row(name))

  const eachAfterTheOneBefore = rows.slice(1).map((element, index) => precedes(rows[index], element))
  expect(eachAfterTheOneBefore).toEqual([true, true, true, true, true, true])
})

test('O13 opening an exercise with 3 of 4 sets logged asks for its fourth set', async () => {
  const { user, onOpenSet } = renderList([
    entry('back-squat', 1),
    entry('back-squat', 2),
    entry('back-squat', 3),
  ])

  await user.click(row('Back squat'))

  expect(onOpenSet.mock.calls).toEqual([['back-squat', 4]])
})

test('O13 opening an exercise with nothing logged asks for its first set', async () => {
  const { user, onOpenSet } = renderList([])

  await user.click(row('Lunges'))

  expect(onOpenSet.mock.calls).toEqual([['lunges', 1]])
})

// --- E3-T4's [O10]: the list is rows, and nothing else ------------------------------------
//
// This O10 is E3's -- the exercise list inside the shell -- not E1's O10 in SetScreen.test.tsx.
// That the action bar holds "Finish workout", and that pressing it still finishes the session,
// is proven through App in src/App.test.tsx; what the list itself owes is the absence.

test('O10 the exercise list renders no Finish workout control of its own', () => {
  renderList([])

  // The one action that matters is the shell's, pinned to the bottom of the screen. A second
  // one trailing the rows would be a second way to end the workout, off-screen on a long list.
  expect(screen.queryByRole('button', { name: 'Finish workout' })).toBeNull()
  expect(row('Back squat')).toBeVisible()
})

// --- E5-T14: a swap is honest for the rest of the session, and one tap away next time --------
//
// seated-biceps-curls is Workout B's last plan (sets: 3, repRange: [10, 12], restSeconds: 90 in
// src/data/programs/assaf-ab-2026.json). Hammer_Curls is a real free-exercise-db entry named
// "Hammer Curls" (src/data/library/exercises.json), so these rows resolve it through the same
// `resolveExercise` the app hands the list, against the real library fixture.

const workoutB = assaf.workouts[1]
const library = new Map(
  (libraryJson as unknown as LibraryExercise[]).map((libraryEntry) => [libraryEntry.id, libraryEntry] as const),
)
const resolveWithLibrary = (id: string): Exercise | undefined => resolveExercise(id, catalog, library)

/** The accessible-name prefix of seated-biceps-curls' row once it is swapped for Hammer_Curls. */
const SWAPPED_ROW = /^Hammer Curls, instead of Seated biceps curls, 3 sets, 10-12 reps, 90s rest/

const HAMMER_SWAP = { 'seated-biceps-curls': 'Hammer_Curls' }

function workoutBSession(entries: SetEntry[], swaps?: Record<string, string>): Session {
  return {
    id: 'session-under-test',
    programId: assaf.id,
    workoutId: workoutB.id,
    startedAt: BASE,
    finishedAt: null,
    entries,
    ...(swaps ? { swaps } : {}),
  }
}

function renderWorkoutB(session: Session, lastSwaps: Record<string, string> = {}) {
  const user = userEvent.setup()
  const onUndoSwap = vi.fn()
  const onApplySwap = vi.fn()
  const props = {
    program: assaf,
    workout: workoutB,
    resolve: resolveWithLibrary,
    onOpenSet: vi.fn(),
    onFinish: vi.fn(),
    lastSwaps,
    onUndoSwap,
    onApplySwap,
  }
  const view = render(<ExerciseList {...props} session={session} />)
  const rerenderWith = (next: Session) => view.rerender(<ExerciseList {...props} session={next} />)
  return { user, onUndoSwap, onApplySwap, rerenderWith }
}

test('S8 a swapped row with no Hammer_Curls set logged offers Undo swap', () => {
  renderWorkoutB(
    workoutBSession([entry('seated-biceps-curls', 1), entry('seated-biceps-curls', 2)], HAMMER_SWAP),
  )

  expect(screen.getByRole('button', { name: SWAPPED_ROW })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Undo swap' })).toBeVisible()
})

test('S8 tapping Undo swap asks to undo the swap of the planned seated-biceps-curls', async () => {
  const { user, onUndoSwap } = renderWorkoutB(workoutBSession([], HAMMER_SWAP))

  await user.click(screen.getByRole('button', { name: 'Undo swap' }))

  expect(onUndoSwap.mock.calls).toEqual([['seated-biceps-curls']])
})

test('S8 Undo swap is withdrawn once the first Hammer_Curls set is logged', () => {
  const before = [entry('seated-biceps-curls', 1), entry('seated-biceps-curls', 2)]
  const { rerenderWith } = renderWorkoutB(workoutBSession(before, HAMMER_SWAP))
  expect(screen.getByRole('button', { name: 'Undo swap' })).toBeVisible()

  rerenderWith(workoutBSession([...before, entry('Hammer_Curls', 1)], HAMMER_SWAP))

  expect(screen.getByRole('button', { name: SWAPPED_ROW })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Undo swap' })).toBeNull()
})

test('S10 a plan swapped last time and not today shows its own row with a Last time button naming the done exercise', () => {
  renderWorkoutB(workoutBSession([]), HAMMER_SWAP)

  expect(screen.getByRole('button', { name: /^Seated biceps curls/ })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Last time: Hammer Curls' })).toBeVisible()
})

test('S10 tapping Last time asks to apply the same swap of seated-biceps-curls for Hammer_Curls', async () => {
  const { user, onApplySwap } = renderWorkoutB(workoutBSession([]), HAMMER_SWAP)

  await user.click(screen.getByRole('button', { name: 'Last time: Hammer Curls' }))

  expect(onApplySwap.mock.calls).toEqual([['seated-biceps-curls', 'Hammer_Curls']])
})

test('S10 a Last time swap to an id neither catalog nor library knows is named by its raw id', () => {
  renderWorkoutB(workoutBSession([]), { 'seated-biceps-curls': 'Retired_Curl' })

  expect(screen.getByRole('button', { name: 'Last time: Retired_Curl' })).toBeVisible()
})

test('S10 a plan already swapped today offers no Last time button', () => {
  renderWorkoutB(workoutBSession([], HAMMER_SWAP), HAMMER_SWAP)

  expect(screen.getByRole('button', { name: 'Undo swap' })).toBeVisible()
  expect(screen.queryByRole('button', { name: /^Last time/ })).toBeNull()
})
