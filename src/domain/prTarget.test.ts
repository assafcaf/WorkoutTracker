import { expect, test } from 'vitest'
import { loadCatalog } from '../data/catalog'
import { prTargetReps, prTargetText } from './prTarget'
import type { Exercise, ExercisePlan, Session } from '../types'

const T = 1_700_000_000_000
const DAY = 86_400_000
const squat = loadCatalog().get('back-squat') as Exercise
const plan: ExercisePlan = { exerciseId: 'back-squat', sets: 3, repRange: [8, 10], restSeconds: 180 }

function finished(id: string, daysAgo: number, sets: [number, number][]): Session {
  const startedAt = T - daysAgo * DAY
  return {
    id,
    programId: 'p',
    workoutId: 'w',
    startedAt,
    finishedAt: startedAt + 3_600_000,
    entries: sets.map(([weightKg, reps], index) => ({
      exerciseId: 'back-squat',
      setIndex: index + 1,
      weightKg,
      reps,
      loggedAt: startedAt + index * 60_000,
    })),
  }
}

const today: Session = { id: 'today', programId: 'p', workoutId: 'w', startedAt: T, finishedAt: null, entries: [] }
const earlier = [finished('a', 7, [[80, 8], [80, 8]])]

test('V2-04 at the record weight the PR target is one rep past the record, 80 kg -> 9 reps', () => {
  expect(prTargetReps({ exercise: squat, plan, earlier, session: today, set: { weightKg: 80 } })).toBe(9)
})

test('V2-04 a weight heavier than ever is a PR at 1 rep', () => {
  expect(prTargetReps({ exercise: squat, plan, earlier, session: today, set: { weightKg: 85 } })).toBe(1)
})

test('V2-04 with no Record reachable within the Plan rep range the target is null', () => {
  expect(prTargetReps({ exercise: squat, plan, earlier, session: today, set: { weightKg: 60 } })).toBeNull()
})

test('V2-04 the first Session of an Exercise, a Warm-up and a Drop set have no target', () => {
  expect(prTargetReps({ exercise: squat, plan, earlier: [], session: today, set: { weightKg: 80 } })).toBeNull()
  expect(
    prTargetReps({ exercise: squat, plan, earlier, session: today, set: { weightKg: 85, kind: 'warmup' } }),
  ).toBeNull()
  expect(
    prTargetReps({ exercise: squat, plan, earlier, session: today, set: { weightKg: 85, kind: 'drop' } }),
  ).toBeNull()
})

test('V2-04 prTargetText reads PR at 9 reps, and PR at 1 rep', () => {
  expect(prTargetText(9)).toBe('PR at 9 reps')
  expect(prTargetText(1)).toBe('PR at 1 rep')
})
