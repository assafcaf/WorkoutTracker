import { expect, test } from 'vitest'
import type { Exercise, Session, SetEntry } from '../types'
import { myLifts } from './myLifts'

// V6-03 step 3: the Exercises tab's "My lifts" -- the lifter's own Program Exercises and
// anything with history, most recent first.

const EXERCISES: Record<string, Exercise> = {
  'back-squat': { id: 'back-squat', libraryId: 'Barbell_Squat', name: 'Back squat', weightStep: 2.5, startWeight: 20, bodyweight: false },
  deadlift: { id: 'deadlift', libraryId: 'Barbell_Deadlift', name: 'Deadlift', weightStep: 2.5, startWeight: 40, bodyweight: false },
  'pull-up': { id: 'pull-up', libraryId: 'Pullups', name: 'Pull-up', weightStep: 2.5, startWeight: null, bodyweight: true },
  'Hammer_Curls': { id: 'Hammer_Curls', libraryId: 'Hammer_Curls', name: 'Hammer Curls', weightStep: 1, startWeight: 8, bodyweight: false },
}
const resolve = (id: string): Exercise | undefined => EXERCISES[id]

function set(exerciseId: string, setIndex: number, weightKg: number | null, reps: number, extra: Partial<SetEntry> = {}): SetEntry {
  return { exerciseId, setIndex, weightKg, reps, loggedAt: 0, ...extra }
}

function session(id: string, startedAt: number, entries: SetEntry[], finished = true): Session {
  return { id, programId: 'p', workoutId: 'w', startedAt, finishedAt: finished ? startedAt + 3_600_000 : null, entries }
}

test('V6-03 My lifts lists the Program Exercises and every logged one, most recent first', () => {
  const sessions = [
    session('old', 1_000, [set('deadlift', 1, 60, 5)]),
    session('new', 5_000, [set('back-squat', 1, 60, 8), set('Hammer_Curls', 1, 10, 12)]),
  ]

  const lifts = myLifts(['deadlift', 'back-squat', 'pull-up'], sessions, resolve)

  expect(lifts.map((lift) => lift.name)).toEqual(['Back squat', 'Hammer Curls', 'Deadlift', 'Pull-up'])
  expect(lifts.find((lift) => lift.exerciseId === 'pull-up')?.lastAt).toBeNull()
  expect(lifts.find((lift) => lift.exerciseId === 'deadlift')?.lastAt).toBe(1_000)
})

test('V6-03 a My lifts row carries the latest Session top working Set, never a warm-up', () => {
  const sessions = [
    session('old', 1_000, [set('back-squat', 1, 100, 3)]),
    session('new', 5_000, [
      set('back-squat', 1, 40, 5, { kind: 'warmup' }),
      set('back-squat', 2, 62.5, 8),
      set('back-squat', 3, 62.5, 6),
      set('back-squat', 4, 60, 10),
    ]),
  ]

  const [lift] = myLifts(['back-squat'], sessions, resolve)

  expect(lift.top).toMatchObject({ weightKg: 62.5, reps: 8 })
})

test('V6-03 My lifts ignores Sessions still in progress and ids nothing resolves', () => {
  const sessions = [
    session('live', 9_000, [set('deadlift', 1, 80, 5)], false),
    session('done', 2_000, [set('gone-exercise', 1, 10, 10)]),
  ]

  const lifts = myLifts(['deadlift'], sessions, resolve)

  expect(lifts).toEqual([{ exerciseId: 'deadlift', name: 'Deadlift', lastAt: null, top: null }])
})

test('V6-03 a Bodyweight lift top Set is the one with the most Load, then reps', () => {
  const sessions = [
    session('s', 1_000, [
      set('pull-up', 1, null, 10),
      set('pull-up', 2, null, 6, { loadKg: 5 }),
      set('pull-up', 3, null, 8, { loadKg: 5 }),
    ]),
  ]

  const [lift] = myLifts([], sessions, resolve)

  expect(lift.top).toMatchObject({ loadKg: 5, reps: 8 })
})
