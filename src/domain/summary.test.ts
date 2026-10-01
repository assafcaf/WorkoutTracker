import { expect, test } from 'vitest'
import { summarize } from './summary'
import type { Resolve } from './muscles'
import type { Exercise, ExercisePlan, Session, SetEntry } from '../types'

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
  return { setIndex: 1, weightKg: 20, reps: 10, loggedAt: 0, ...overrides }
}

function session(overrides: Partial<Session> & { id: string; entries: SetEntry[] }): Session {
  return {
    programId: 'p',
    workoutId: 'w',
    startedAt: 100,
    finishedAt: 100,
    ...overrides,
  }
}

const squat = exercise({ id: 'back-squat', name: 'Back Squat' })
const pushup = exercise({ id: 'push-up', name: 'Push Up', bodyweight: true })
const bench = exercise({ id: 'bench', name: 'Bench Press' })
const catalog = new Map<string, Exercise>([
  [squat.id, squat],
  [pushup.id, pushup],
  [bench.id, bench],
])
const resolve: Resolve = (id) => catalog.get(id)

const plans: Record<string, ExercisePlan> = {
  'back-squat': { exerciseId: 'back-squat', sets: 3, repRange: [8, 10], restSeconds: 120 },
  'push-up': { exerciseId: 'push-up', sets: 3, repRange: [10, 15], restSeconds: 60 },
  bench: { exerciseId: 'bench', sets: 3, repRange: [8, 10], restSeconds: 120 },
}
const planFor = (id: string) => plans[id]

const earlierSquat = session({
  id: 'e1',
  startedAt: 10,
  finishedAt: 20,
  entries: [setEntry({ exerciseId: 'back-squat', weightKg: 60, reps: 8 })],
})

test('O15 durationMs is finishedAt minus startedAt', () => {
  const s = session({ id: 's', startedAt: 1000, finishedAt: 1000 + 45 * 60_000, entries: [] })
  expect(summarize(s, [], resolve, planFor).durationMs).toBe(2_700_000)
})

test('O15 volumeKg and bodyweightReps follow the Stats volume rule', () => {
  const s = session({
    id: 's',
    entries: [
      setEntry({ exerciseId: 'back-squat', weightKg: 60, reps: 8 }),
      setEntry({ exerciseId: 'back-squat', weightKg: 50, reps: 10 }),
      setEntry({ exerciseId: 'push-up', weightKg: null, reps: 12 }),
      setEntry({ exerciseId: 'unknown', weightKg: 99, reps: 99 }),
    ],
  })
  const result = summarize(s, [], resolve, planFor)
  expect(result.volumeKg).toBe(980)
  expect(result.bodyweightReps).toBe(12)
})

test('O15 records list every record the Session changed, for an Exercise with an earlier Session', () => {
  const s = session({
    id: 's',
    startedAt: 100,
    entries: [setEntry({ exerciseId: 'back-squat', weightKg: 70, reps: 8 })],
  })
  const result = summarize(s, [earlierSquat], resolve, planFor)
  expect(result.records).toHaveLength(1)
  expect(result.records[0].exerciseId).toBe('back-squat')
  expect(result.records[0].name).toBe('Back Squat')
  expect(result.records[0].records.map((r) => r.kind)).toEqual([
    'heaviest-set',
    'best-e1rm',
    'most-reps-at-weight',
  ])
  expect(result.records[0].records[0]).toEqual({
    kind: 'heaviest-set',
    label: 'Heaviest set',
    value: 70,
    weightKg: 70,
    reps: 8,
    at: 100,
  })
})

test('O15 records include only the kinds that changed; a tie on the heaviest set changes nothing', () => {
  const s = session({
    id: 's',
    startedAt: 100,
    entries: [setEntry({ exerciseId: 'back-squat', weightKg: 60, reps: 10 })],
  })
  const result = summarize(s, [earlierSquat], resolve, planFor)
  expect(result.records[0].records.map((r) => r.kind)).toEqual(['best-e1rm', 'most-reps-at-weight'])
})

test('O15 an Exercise whose records did not change is left out of records', () => {
  const s = session({
    id: 's',
    startedAt: 100,
    entries: [
      setEntry({ exerciseId: 'back-squat', weightKg: 40, reps: 5 }),
      setEntry({ exerciseId: 'push-up', weightKg: null, reps: 20 }),
    ],
  })
  const earlier = [
    earlierSquat,
    session({
      id: 'e2',
      startedAt: 11,
      entries: [setEntry({ exerciseId: 'push-up', weightKg: null, reps: 10 })],
    }),
  ]
  const result = summarize(s, earlier, resolve, planFor)
  expect(result.records.map((r) => r.exerciseId)).toEqual(['push-up'])
  expect(result.records[0].records.map((r) => r.kind)).toEqual(['most-reps-in-a-set'])
})

test('O15 with no earlier Session, records is empty', () => {
  const s = session({
    id: 's',
    entries: [setEntry({ exerciseId: 'back-squat', weightKg: 70, reps: 8 })],
  })
  expect(summarize(s, [], resolve, planFor).records).toEqual([])
})

test('O15 with no earlier Session holding the Exercise, that Exercise has no records', () => {
  const s = session({
    id: 's',
    entries: [
      setEntry({ exerciseId: 'back-squat', weightKg: 70, reps: 8 }),
      setEntry({ exerciseId: 'bench', weightKg: 50, reps: 8 }),
    ],
  })
  const result = summarize(s, [earlierSquat], resolve, planFor)
  expect(result.records.map((r) => r.exerciseId)).toEqual(['back-squat'])
})

test('O15 an Exercise with no plan is left out of records', () => {
  const s = session({
    id: 's',
    entries: [setEntry({ exerciseId: 'back-squat', weightKg: 70, reps: 8 })],
  })
  expect(summarize(s, [earlierSquat], resolve, () => undefined).records).toEqual([])
})
