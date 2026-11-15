import { expect, test } from 'vitest'
import type { ExercisePlan, Program, Session, SetEntry } from '../types'
import { nextWorkout, shortSessionOf, workoutNote } from './shortSession'

// V6-11: a Session that logged fewer than half its Workout's planned Sets does not move the
// rotation on: the same Workout stays next, with how many of its lifts are left.

const MON = new Date(2026, 9, 12, 18).getTime()
const WED = new Date(2026, 9, 14, 18).getTime()
const THU = new Date(2026, 9, 15, 18).getTime()

const plan = (exerciseId: string, sets: number): ExercisePlan => ({ exerciseId, sets, repRange: [8, 10], restSeconds: 90 })

const PROGRAM: Program = {
  id: 'ab',
  name: 'A / B',
  units: 'kg',
  sessionsPerWeek: 3,
  workouts: [
    { id: 'a', name: 'Workout A', exercises: [plan('squat', 4), plan('bench', 4)] },
    // 3 + 4 + 3 + 4 = 14 Sets over 4 lifts: 6 Sets is short, 7 is not.
    { id: 'b', name: 'Workout B', exercises: [plan('deadlift', 3), plan('pullups', 4), plan('row', 3), plan('curl', 4)] },
  ],
}

function entry(exerciseId: string, setIndex: number, kind?: 'warmup'): SetEntry {
  return { exerciseId, setIndex, weightKg: 60, reps: 8, loggedAt: THU + setIndex, ...(kind ? { kind } : {}) }
}

function session(id: string, workoutId: string, startedAt: number, entries: SetEntry[], extra: Partial<Session> = {}): Session {
  return { id, programId: 'ab', workoutId, startedAt, finishedAt: startedAt + 3_600_000, entries, ...extra }
}

const FULL_A = session('a1', 'a', MON, [1, 2, 3, 4].flatMap((i) => [entry('squat', i), entry('bench', i)]))

test('V6-11 a Session with fewer than half its planned Sets is short; it names the lifts left', () => {
  const short = session('b1', 'b', THU, [entry('deadlift', 1), entry('deadlift', 2)])
  const found = shortSessionOf(PROGRAM, [FULL_A, short])
  expect(found).not.toBeNull()
  expect(found?.workout.id).toBe('b')
  expect(found?.logged).toBe(2)
  expect(found?.planned).toBe(14)
  expect(found?.liftsLeft).toBe(3)
})

test('V6-11 half the planned Sets or more is a full Session, and warm-ups do not count', () => {
  const half = session('b1', 'b', THU, [1, 2, 3].map((i) => entry('deadlift', i)).concat([1, 2, 3, 4].map((i) => entry('pullups', i))))
  expect(shortSessionOf(PROGRAM, [FULL_A, half])).toBeNull()
  const warmups = session('b2', 'b', THU, [
    entry('deadlift', 1, 'warmup'),
    entry('deadlift', 2, 'warmup'),
    entry('deadlift', 3, 'warmup'),
    entry('deadlift', 4, 'warmup'),
    entry('deadlift', 5, 'warmup'),
    entry('deadlift', 6, 'warmup'),
    entry('deadlift', 7),
  ])
  expect(shortSessionOf(PROGRAM, [FULL_A, warmups])?.logged).toBe(1)
})

test('V6-11 a swapped lift counts under the Exercise done in its place', () => {
  const swapped = session('b1', 'b', THU, [entry('rdl', 1), entry('rdl', 2)], { swaps: { deadlift: 'rdl' } })
  expect(shortSessionOf(PROGRAM, [FULL_A, swapped])?.liftsLeft).toBe(3)
})

test('V6-11 only the latest finished Session of the Program decides', () => {
  const short = session('b1', 'b', WED, [entry('deadlift', 1)])
  const laterA = session('a2', 'a', THU, FULL_A.entries)
  expect(shortSessionOf(PROGRAM, [short, laterA])).toBeNull()
  const inProgress = session('b2', 'b', THU, [entry('deadlift', 1)], { finishedAt: null })
  expect(shortSessionOf(PROGRAM, [FULL_A, inProgress])).toBeNull()
  const deleted = session('b3', 'b', THU, [entry('deadlift', 1)], { deletedAt: THU + 1 })
  expect(shortSessionOf(PROGRAM, [FULL_A, deleted])).toBeNull()
})

test('V6-11 after a short Workout B the same Workout B is next; after a full one, Workout A', () => {
  const short = session('b1', 'b', THU, [entry('deadlift', 1), entry('deadlift', 2)])
  const next = nextWorkout(PROGRAM, [FULL_A, short])
  expect(next?.workout.id).toBe('b')
  expect(next?.lastDoneAt).toBe(THU)
  expect(next?.short?.liftsLeft).toBe(3)

  const full = session('b1', 'b', THU, [1, 2, 3].map((i) => entry('deadlift', i)).concat([1, 2, 3, 4].map((i) => entry('pullups', i))))
  const after = nextWorkout(PROGRAM, [FULL_A, full])
  expect(after?.workout.id).toBe('a')
  expect(after?.short).toBeNull()
})

test('V6-08 a Workout\'s latest Session note, with the day it was written', () => {
  const noted = session('b0', 'b', MON, [], { note: 'Right elbow sore on pull-downs, dropped the weight.' })
  const later = session('b1', 'b', THU, [entry('deadlift', 1)])
  const other = session('a1', 'a', WED, [], { note: 'Left shoulder tight.' })
  expect(workoutNote('b', [noted, later, other])).toEqual({ at: MON, text: 'Right elbow sore on pull-downs, dropped the weight.' })
  expect(workoutNote('a', [noted, later, other])?.text).toBe('Left shoulder tight.')
  expect(workoutNote('b', [later])).toBeNull()
  expect(workoutNote('b', [{ ...noted, deletedAt: THU }])).toBeNull()
  expect(workoutNote('b', [{ ...noted, note: '   ' }])).toBeNull()
})
