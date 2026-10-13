import { expect, test } from 'vitest'
import {
  exerciseRows,
  percentChange,
  previousOfWorkout,
  recordCount,
  recordGain,
  recordTrend,
  summarize,
} from './summary'
import type { Resolve } from './muscles'
import type { Exercise, ExercisePlan, Session, SetEntry } from '../types'

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

// --- E17 S5b: what the restyled summary reads beside summarize ----------------------------------

test('S5b summarize keeps each changed Exercise’s records as they stood before, and recordCount totals them', () => {
  const s = session({
    id: 's',
    startedAt: 100,
    entries: [setEntry({ exerciseId: 'back-squat', weightKg: 70, reps: 8 })],
  })
  const result = summarize(s, [earlierSquat], resolve, planFor)
  expect(result.records[0].before.find((r) => r.kind === 'heaviest-set')?.value).toBe(60)
  expect(recordCount(result)).toBe(3)
})

test('S5b recordGain is the move past the earlier record, in kg or reps, and null with none', () => {
  const s = session({
    id: 's',
    startedAt: 100,
    entries: [setEntry({ exerciseId: 'back-squat', weightKg: 62.5, reps: 8 })],
  })
  const [entry] = summarize(s, [earlierSquat], resolve, planFor).records
  const heaviest = entry.records.find((r) => r.kind === 'heaviest-set')!
  expect(recordGain(heaviest, entry.before)).toEqual({ amount: 2.5, unit: 'kg' })
  expect(recordGain(heaviest, [])).toBeNull()
  const reps = { ...heaviest, kind: 'most-reps-in-a-set' as const, value: 12 }
  expect(recordGain(reps, [{ ...reps, value: 10 }])).toEqual({ amount: 2, unit: 'reps' })
})

test('S5b previousOfWorkout is the latest earlier finished Session of the same Workout', () => {
  const s = session({ id: 's', startedAt: 100, entries: [] })
  const older = session({ id: 'older', startedAt: 10, entries: [] })
  const newer = session({ id: 'newer', startedAt: 50, entries: [] })
  const otherWorkout = session({ id: 'b', workoutId: 'other', startedAt: 90, entries: [] })
  const unfinished = session({ id: 'open', startedAt: 95, finishedAt: null, entries: [] })
  expect(previousOfWorkout(s, [older, newer, otherWorkout, unfinished])?.id).toBe('newer')
  expect(previousOfWorkout(s, [otherWorkout])).toBeUndefined()
})

test('S5b percentChange reads 9,840 against 9,410 as +4.6 and is null with no base', () => {
  expect(percentChange(9840, 9410)).toBe(4.6)
  expect(percentChange(900, 1000)).toBe(-10)
  expect(percentChange(900, 0)).toBeNull()
})

test('S5b recordTrend lists the record kind per Session holding the Exercise, oldest first, the last few', () => {
  const sessions = [60, 52.5, 55, 57.5, 62.5].map((weightKg, index) =>
    session({ id: `t${index}`, startedAt: 100 - index, entries: [setEntry({ exerciseId: 'back-squat', weightKg, reps: 8 })] }),
  )
  sessions.push(session({ id: 'none', startedAt: 1, entries: [setEntry({ exerciseId: 'bench' })] }))
  expect(recordTrend(squat, plans['back-squat'], 'heaviest-set', sessions)).toEqual([62.5, 57.5, 55, 52.5, 60])
  expect(recordTrend(squat, plans['back-squat'], 'heaviest-set', sessions, 2)).toEqual([52.5, 60])
})

test('S5b exerciseRows gives each Exercise its best Set, volume and change from the last Session that held it', () => {
  const s = session({
    id: 's',
    startedAt: 100,
    entries: [
      setEntry({ exerciseId: 'back-squat', weightKg: 60, reps: 10, kind: 'warmup' }),
      setEntry({ exerciseId: 'back-squat', weightKg: 62.5, reps: 8 }),
      setEntry({ exerciseId: 'back-squat', weightKg: 62.5, reps: 9 }),
      setEntry({ exerciseId: 'push-up', weightKg: null, reps: 15 }),
      setEntry({ exerciseId: 'ghost', weightKg: 10, reps: 10 }),
    ],
  })
  const rows = exerciseRows(s, [earlierSquat], resolve)
  expect(rows.map((row) => row.name)).toEqual(['Back Squat', 'Push Up'])
  expect(rows[0].best).toMatchObject({ weightKg: 62.5, reps: 9 })
  expect(rows[0].volume).toEqual({ amount: 1062.5, unit: 'kg' })
  expect(rows[0].delta).toBe(1062.5 - 480)
  expect(rows[1].volume).toEqual({ amount: 15, unit: 'reps' })
  expect(rows[1].delta).toBeNull()
})
