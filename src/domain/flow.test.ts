import { expect, test } from 'vitest'
import type { ExercisePlan, Session, SetEntry, Workout } from '../types'
import { nextExerciseAfter } from './flow'

// A workout of four Plans: squat 2 sets, press 2, row 1, curl 3.
function plan(exerciseId: string, sets: number): ExercisePlan {
  return { exerciseId, sets, repRange: [8, 10], restSeconds: 90 }
}

const workout: Workout = {
  id: 'w',
  name: 'W',
  exercises: [plan('squat', 2), plan('press', 2), plan('row', 1), plan('curl', 3)],
}

function sets(exerciseId: string, count: number): SetEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    exerciseId,
    setIndex: index + 1,
    weightKg: 20,
    reps: 10,
    loggedAt: 1_000 + index,
  }))
}

function session(entries: SetEntry[], swaps?: Record<string, string>): Session {
  return {
    id: 's',
    programId: 'p',
    workoutId: 'w',
    startedAt: 0,
    finishedAt: null,
    entries,
    ...(swaps ? { swaps } : {}),
  }
}

test('O10 nextExerciseAfter answers the Plan right after the current one when it has no Sets logged', () => {
  expect(nextExerciseAfter(workout, session(sets('squat', 2)), 'squat')).toBe('press')
})

test('O10 nextExerciseAfter skips a Plan whose planned Sets are all logged', () => {
  const done = session([...sets('squat', 2), ...sets('press', 2)])

  expect(nextExerciseAfter(workout, done, 'squat')).toBe('row')
})

test('O10 nextExerciseAfter treats a Plan with fewer logged Sets than planned as not done', () => {
  const partial = session([...sets('squat', 2), ...sets('press', 1)])

  expect(nextExerciseAfter(workout, partial, 'squat')).toBe('press')
})

test('O10 nextExerciseAfter counts a Plan with more Sets logged than planned as done', () => {
  const extra = session([...sets('squat', 2), ...sets('press', 3)])

  expect(nextExerciseAfter(workout, extra, 'squat')).toBe('row')
})

test('O10 nextExerciseAfter wraps to the start after the last Plan', () => {
  const done = session([...sets('press', 2), ...sets('row', 1), ...sets('curl', 3)])

  expect(nextExerciseAfter(workout, done, 'curl')).toBe('squat')
})

test('O10 nextExerciseAfter wraps past Plans before the current one that are done', () => {
  const done = session([...sets('squat', 2), ...sets('press', 2), ...sets('row', 1)])

  expect(nextExerciseAfter(workout, done, 'row')).toBe('curl')
})

test('O10 nextExerciseAfter answers null when every Plan is done', () => {
  const all = session([
    ...sets('squat', 2),
    ...sets('press', 2),
    ...sets('row', 1),
    ...sets('curl', 3),
  ])

  expect(nextExerciseAfter(workout, all, 'curl')).toBeNull()
})

test('O10 nextExerciseAfter answers the swap of a swapped Plan, not the planned id', () => {
  const swapped = session(sets('squat', 2), { press: 'db-press' })

  expect(nextExerciseAfter(workout, swapped, 'squat')).toBe('db-press')
})

test('O10 nextExerciseAfter counts the swap’s Sets, not the planned Exercise’s, toward a swapped Plan', () => {
  // press was done (2 Sets) before the swap; the swap has only 1 of 2 logged.
  const swapped = session([...sets('squat', 2), ...sets('press', 2), ...sets('db-press', 1)], {
    press: 'db-press',
  })

  expect(nextExerciseAfter(workout, swapped, 'squat')).toBe('db-press')
})

test('O10 nextExerciseAfter treats a swapped Plan as done once the swap has all its Sets', () => {
  const swapped = session([...sets('squat', 2), ...sets('db-press', 2)], { press: 'db-press' })

  expect(nextExerciseAfter(workout, swapped, 'squat')).toBe('row')
})

test('O10 nextExerciseAfter finds the current Plan from its swap’s id', () => {
  const swapped = session(sets('db-press', 2), { press: 'db-press' })

  expect(nextExerciseAfter(workout, swapped, 'db-press')).toBe('row')
})

// E14-T8 O4: warm-ups don't use up a Plan's Sets.
function warmups(exerciseId: string, count: number): SetEntry[] {
  return sets(exerciseId, count).map((entry) => ({ ...entry, kind: 'warmup' as const }))
}

test('O4 nextExerciseAfter treats a Plan holding only warm-ups as not done', () => {
  const warmedUp = session([...sets('squat', 2), ...warmups('press', 2)])

  expect(nextExerciseAfter(workout, warmedUp, 'squat')).toBe('press')
})

test('O4 nextExerciseAfter treats a Plan with 2 warm-ups and 1 of 2 working Sets as not done', () => {
  const press: SetEntry[] = [
    ...warmups('press', 2),
    { exerciseId: 'press', setIndex: 3, weightKg: 40, reps: 8, loggedAt: 2_000 },
  ]
  const partial = session([...sets('squat', 2), ...press])

  expect(nextExerciseAfter(workout, partial, 'squat')).toBe('press')
})
