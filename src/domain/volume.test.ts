import { expect, test } from 'vitest'
import { sessionVolume, volumeSeries } from './volume'
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

const squat = exercise({ id: 'back-squat', bodyweight: false })
const pushup = exercise({ id: 'push-up', bodyweight: true })
// Assisted is a Bodyweight Exercise at a negative signed Load (E16-T10 removed invertProgress).
const assistedDip = exercise({ id: 'assisted-dip', bodyweight: true, startWeight: null })

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
    entries: [setEntry({ exerciseId: 'assisted-dip', weightKg: null, loadKg: -15, reps: 8 })],
  })

  const [point] = volumeSeries([assistedSession], resolve, [fixtureProgram])

  expect(assistedDip).not.toHaveProperty('invertProgress')
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

test('O15 sessionVolume answers the kg and bodyweight reps of one session by the series rule', () => {
  const s = session({
    id: 'sv',
    entries: [
      setEntry({ exerciseId: 'back-squat', weightKg: 60, reps: 8 }),
      setEntry({ exerciseId: 'push-up', weightKg: null, reps: 12 }),
      setEntry({ exerciseId: 'assisted-dip', weightKg: 30, reps: 6 }),
      setEntry({ exerciseId: 'unknown', weightKg: 99, reps: 99 }),
    ],
  })

  expect(sessionVolume(s, resolve)).toEqual({ kg: 480, bodyweightReps: 18 })
})

test('O3 volumeSeries answers what it answers with the warm-up Sets removed', () => {
  const s = session({
    id: 'warm',
    startedAt: 5,
    entries: [
      setEntry({ exerciseId: 'back-squat', weightKg: 20, reps: 10, kind: 'warmup' }),
      setEntry({ exerciseId: 'back-squat', weightKg: 60, reps: 8 }),
      setEntry({ exerciseId: 'push-up', weightKg: null, reps: 5, kind: 'warmup' }),
      setEntry({ exerciseId: 'push-up', weightKg: null, reps: 12 }),
    ],
  })

  expect(volumeSeries([s], resolve, [])).toEqual([
    { at: 5, workoutName: 'fixture-workout', kg: 480, bodyweightReps: 12 },
  ])
})

// E22-T3 [O7 O8]: a bodyweight makes Bodyweight Sets count (bodyweight + loadKg) x reps kg.
const pullup = exercise({ id: 'pullup', bodyweight: true, weightStep: 1, startWeight: null })
const bwSquat = exercise({ id: 'squat' })
const bwResolve: Resolve = (id) => [pullup, bwSquat].find((e) => e.id === id)
const bwSession = (startedAt: number, entries: SetEntry[]): Session => ({
  id: `s${startedAt}`, programId: 'nope', workoutId: 'w', startedAt, finishedAt: startedAt + 1, entries,
})
const bwSets: SetEntry[] = [
  setEntry({ exerciseId: 'pullup', setIndex: 0, weightKg: null, reps: 8, loadKg: 10 }),
  setEntry({ exerciseId: 'pullup', setIndex: 1, weightKg: null, reps: 10, loadKg: -20 }),
  setEntry({ exerciseId: 'pullup', setIndex: 2, weightKg: null, reps: 12 }),
  setEntry({ exerciseId: 'pullup', setIndex: 3, weightKg: null, reps: 5, kind: 'warmup' }),
  setEntry({ exerciseId: 'squat', setIndex: 0, weightKg: 50, reps: 10 }),
]

test('O7 sessionVolume at 80 kg counts BW+10 x 8, assisted BW-20 x 10 and BW x 12, plus loaded sets', () => {
  const out = sessionVolume(bwSession(1, bwSets), bwResolve, 80)
  expect(out.kg).toBe(720 + 600 + 960 + 500)
  expect(out.bodyweightReps).toBe(0)
  expect(out.bodyweightKg).toBe(80)
})

test('O7 sessionVolume floors a Set at 0 when assistance outweighs the bodyweight', () => {
  const s = bwSession(1, [setEntry({ exerciseId: 'pullup', weightKg: null, reps: 10, loadKg: -90 })])
  expect(sessionVolume(s, bwResolve, 80).kg).toBe(0)
})

test('O7 sessionVolume without a bodyweight (null or omitted) reads as before and answers no bodyweightKg', () => {
  for (const out of [sessionVolume(bwSession(1, bwSets), bwResolve), sessionVolume(bwSession(1, bwSets), bwResolve, null)]) {
    expect(out.kg).toBe(500)
    expect(out.bodyweightReps).toBe(30)
    expect(out.bodyweightKg).toBeUndefined()
  }
})

const noon = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime()

test('O8 volumeSeries counts each point at the bodyweight on its day and names it', () => {
  const log = [{ day: '2026-10-01', weightKg: 70 }, { day: '2026-10-08', weightKg: 80 }]
  const early = bwSession(noon(2026, 10, 2), [setEntry({ exerciseId: 'pullup', weightKg: null, reps: 10 })])
  const late = bwSession(noon(2026, 10, 9), [setEntry({ exerciseId: 'pullup', weightKg: null, reps: 10 })])
  const points = volumeSeries([late, early], bwResolve, [], log)
  expect(points.map((p) => p.kg)).toEqual([700, 800])
  expect(points.map((p) => p.bodyweight)).toEqual([
    { kg: 70, day: '2026-10-01' },
    { kg: 80, day: '2026-10-08' },
  ])
  expect(points.map((p) => p.bodyweightReps)).toEqual([0, 0])
})

test('O8 volumeSeries counts a Session before the first weighed day as reps only, with no bodyweight named', () => {
  const log = [{ day: '2026-10-08', weightKg: 80 }]
  const before = bwSession(noon(2026, 10, 2), [setEntry({ exerciseId: 'pullup', weightKg: null, reps: 10 })])
  const [point] = volumeSeries([before], bwResolve, [], log)
  expect(point.kg).toBe(0)
  expect(point.bodyweightReps).toBe(10)
  expect(point.bodyweight).toBeUndefined()
})
