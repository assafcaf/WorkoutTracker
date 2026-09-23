import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { HistoryList, summarise } from './HistoryList'
import type { Program, Session, SetEntry } from '../types'

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
  name: 'Assaf A/B 2026',
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

  expect([summary.programName, summary.workoutName]).toEqual(['Assaf A/B 2026', 'Workout A'])
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

  render(<HistoryList sessions={[session]} programs={[assaf]} />)

  const [row] = screen.getAllByRole('listitem')
  expect(within(row).getByText('2023-11-14')).toBeVisible()
  expect(within(row).getByText('Assaf A/B 2026')).toBeVisible()
  expect(within(row).getByText('Workout A')).toBeVisible()
  expect(within(row).getByText('2 sets')).toBeVisible()
  expect(within(row).getByText('600 kg')).toBeVisible()
})
