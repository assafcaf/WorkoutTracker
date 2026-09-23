import { expect, test } from 'vitest'
import { volumeSeries } from './volume'
import type { Resolve } from './muscles'
import type { Exercise, Program, Session, SetEntry, Workout } from '../types'

// Hand-rolled fixtures, matching programVolume.test.ts's convention -- volumeSeries has no
// dependency on the bundled catalog or library, only on `resolve` and `programs`.
function exercise(overrides: Partial<Exercise> & { id: string }): Exercise {
  return {
    name: 'Fixture Exercise',
    weightStep: 2.5,
    startWeight: 20,
    bodyweight: false,
    invertProgress: false,
    libraryId: 'fixture-lib',
    ...overrides,
  }
}

function setEntry(overrides: Partial<SetEntry> & { exerciseId: string }): SetEntry {
  return {
    setIndex: 0,
    weightKg: 20,
    reps: 10,
    loggedAt: 0,
    ...overrides,
  }
}

function workout(overrides: Partial<Workout> & { id: string; exercises: Workout['exercises'] }): Workout {
  return {
    name: 'Fixture Workout',
    ...overrides,
  }
}

function program(overrides: Partial<Program> & { id: string; workouts: Workout[] }): Program {
  return {
    name: 'Fixture Program',
    units: 'kg',
    sessionsPerWeek: 3,
    ...overrides,
  }
}

function session(overrides: Partial<Session> & { id: string; entries: SetEntry[] }): Session {
  return {
    programId: 'fixture-program',
    workoutId: 'fixture-workout',
    startedAt: 0,
    finishedAt: null,
    ...overrides,
  }
}

// O8: mixed loaded and bodyweight work ---------------------------------------------------------

const squat = exercise({ id: 'back-squat', bodyweight: false, invertProgress: false })
const pushup = exercise({ id: 'push-up', bodyweight: true, invertProgress: false })
const assistedDip = exercise({ id: 'assisted-dip', bodyweight: false, invertProgress: true })

const catalog = new Map<string, Exercise>([
  [squat.id, squat],
  [pushup.id, pushup],
  [assistedDip.id, assistedDip],
])
const resolve: Resolve = (id) => catalog.get(id)

const fixtureWorkout = workout({
  id: 'fixture-workout',
  exercises: [],
})
const fixtureProgram = program({
  id: 'fixture-program',
  workouts: [fixtureWorkout],
})

test('O8 a session mixing loaded and bodyweight work sums reps times weight over loaded sets only', () => {
  const mixedSession = session({
    id: 'session-1',
    startedAt: 100,
    entries: [
      setEntry({ exerciseId: 'back-squat', weightKg: 60, reps: 5 }),
      setEntry({ exerciseId: 'push-up', weightKg: null, reps: 20 }),
    ],
  })

  const [point] = volumeSeries([mixedSession], resolve, [fixtureProgram])

  // back-squat: 60 * 5 = 300 kg; push-up contributes nothing to kg.
  expect(point.kg).toBe(300)
})

test('O8 a session mixing loaded and bodyweight work reports bodyweight sets as a rep count rather than zero kg', () => {
  const mixedSession = session({
    id: 'session-1',
    startedAt: 100,
    entries: [
      setEntry({ exerciseId: 'back-squat', weightKg: 60, reps: 5 }),
      setEntry({ exerciseId: 'push-up', weightKg: null, reps: 20 }),
    ],
  })

  const [point] = volumeSeries([mixedSession], resolve, [fixtureProgram])

  expect(point.bodyweightReps).toBe(20)
})

test('O8 an assisted set with invertProgress true contributes its reps to bodyweightReps, not kg', () => {
  const assistedSession = session({
    id: 'session-2',
    startedAt: 100,
    entries: [setEntry({ exerciseId: 'assisted-dip', weightKg: 15, reps: 8 })],
  })

  const [point] = volumeSeries([assistedSession], resolve, [fixtureProgram])

  expect(point.kg).toBe(0)
  expect(point.bodyweightReps).toBe(8)
})

test('O8 a set that resolve does not answer counts in neither kg nor bodyweightReps', () => {
  const unknownSession = session({
    id: 'session-3',
    startedAt: 100,
    entries: [setEntry({ exerciseId: 'unknown-exercise', weightKg: 60, reps: 5 })],
  })

  const [point] = volumeSeries([unknownSession], resolve, [fixtureProgram])

  expect(point.kg).toBe(0)
  expect(point.bodyweightReps).toBe(0)
})

test('O8 volumeSeries produces one point per session in ascending startedAt order', () => {
  const later = session({
    id: 'session-later',
    startedAt: 200,
    entries: [setEntry({ exerciseId: 'back-squat', weightKg: 10, reps: 1 })],
  })
  const earlier = session({
    id: 'session-earlier',
    startedAt: 100,
    entries: [setEntry({ exerciseId: 'back-squat', weightKg: 20, reps: 1 })],
  })

  const points = volumeSeries([later, earlier], resolve, [fixtureProgram])

  expect(points.map((point) => point.at)).toEqual([100, 200])
})

test('O8 workoutName falls back to session.workoutId when the program is gone', () => {
  const orphanSession = session({
    id: 'session-orphan',
    programId: 'missing-program',
    workoutId: 'missing-workout',
    startedAt: 100,
    entries: [],
  })

  const [point] = volumeSeries([orphanSession], resolve, [fixtureProgram])

  expect(point.workoutName).toBe('missing-workout')
})

test('O8 workoutName is looked up from the session workout in programs when it exists', () => {
  const namedWorkout = workout({
    id: 'workout-named',
    name: 'Push Day',
    exercises: [],
  })
  const namedProgram = program({
    id: 'program-named',
    workouts: [namedWorkout],
  })
  const namedSession = session({
    id: 'session-named',
    programId: 'program-named',
    workoutId: 'workout-named',
    startedAt: 100,
    entries: [],
  })

  const [point] = volumeSeries([namedSession], resolve, [namedProgram])

  expect(point.workoutName).toBe('Push Day')
})
