import { expect, test } from 'vitest'
import { loadCatalog } from '../data/catalog'
import { prMoment } from './prMoment'
import type { Exercise, ExercisePlan, Session, SetEntry } from '../types'

const T = 1_700_000_000_000
const DAY = 86_400_000
const squat = loadCatalog().get('back-squat') as Exercise
const plan: ExercisePlan = { exerciseId: 'back-squat', sets: 4, repRange: [8, 10], restSeconds: 180 }

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

function today(entry: SetEntry): Session {
  return { id: 'today', programId: 'p', workoutId: 'w', startedAt: T, finishedAt: null, entries: [entry] }
}

test('S5a a heavier Set reads New PR · Heaviest set, the Set and the gain, with the history', () => {
  const earlier = [
    finished('a', 14, [[55, 8]]),
    finished('b', 7, [[60, 8], [60, 8]]),
  ]
  const entry: SetEntry = { exerciseId: 'back-squat', setIndex: 1, weightKg: 62.5, reps: 8, loggedAt: T }

  const moment = prMoment(squat, plan, earlier, today(entry), entry)

  expect(moment?.title).toBe(
    'New PR · Heaviest set, Best estimated 1RM, Most reps at the heaviest weight',
  )
  expect(moment?.detail).toBe('62.5 kg × 8 · +2.5 kg')
  expect(moment?.values).toEqual([55, 60, 62.5])
  expect(moment?.label).toBe('Heaviest set history')
})

test('S5a a Set that sets no record has no moment', () => {
  const earlier = [finished('a', 7, [[80, 8]])]
  const entry: SetEntry = { exerciseId: 'back-squat', setIndex: 1, weightKg: 60, reps: 8, loggedAt: T }

  expect(prMoment(squat, plan, earlier, today(entry), entry)).toBeNull()
})

test('S5a the first Session of an Exercise sets no record, so no moment', () => {
  const entry: SetEntry = { exerciseId: 'back-squat', setIndex: 1, weightKg: 100, reps: 8, loggedAt: T }

  expect(prMoment(squat, plan, [], today(entry), entry)).toBeNull()
})
