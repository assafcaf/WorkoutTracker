import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import assafJson from '../data/programs/assaf-ab-2026.json'
import exercisesJson from '../data/exercises.json'
import { ExerciseList } from './ExerciseList'
import type { Exercise, Program, Session, SetEntry } from '../types'

// The list is pure presentation over a session it is handed, so these tests need no database:
// they feed it the shipped program and catalog and a session built by hand. The end-to-end
// half of O13 -- that the list comes back with the session after the app is closed -- lives in
// src/App.test.tsx.
const assaf = assafJson as unknown as Program
const workoutA = assaf.workouts[0]
const catalog = new Map((exercisesJson as Exercise[]).map((exercise) => [exercise.id, exercise] as const))

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
  render(
    <ExerciseList
      program={assaf}
      workout={workoutA}
      catalog={catalog}
      session={sessionWith(entries)}
      onOpenSet={onOpenSet}
    />,
  )
  return { user, onOpenSet }
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
