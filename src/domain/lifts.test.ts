import { describe, expect, test } from 'vitest'
import type { Exercise, LibraryExercise, Program, Session, SetEntry } from '../types'
import { liftChange, liftRecords, loggedLifts, pointsInRange, rangeStart, recordAts, searchEntries, shortDay } from './lifts'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date(2026, 9, 13, 12)

const squat: Exercise = { id: 'back-squat', name: 'Back squat', weightStep: 2.5, startWeight: 40, bodyweight: false, libraryId: 'Barbell_Squat' }
const bench: Exercise = { id: 'db-bench', name: 'DB bench press', weightStep: 2, startWeight: 10, bodyweight: false, libraryId: 'DB_Bench' }
const pushUps: Exercise = { id: 'push-ups', name: 'Push-ups', weightStep: 5, startWeight: null, bodyweight: true, libraryId: 'Pushups' }
const curl: Exercise = { id: 'curl', name: 'Curl', weightStep: 1, startWeight: 5, bodyweight: false, libraryId: 'Curl' }
const EXERCISES = new Map([squat, bench, pushUps, curl].map((exercise) => [exercise.id, exercise] as const))

function set(exerciseId: string, weightKg: number | null, reps: number, extra: Partial<SetEntry> = {}): SetEntry {
  return { exerciseId, setIndex: 0, weightKg, reps, loggedAt: 0, ...extra }
}

function session(id: string, startedAt: number, entries: SetEntry[]): Session {
  return { id, programId: 'p', workoutId: 'w', startedAt, finishedAt: startedAt + 3600_000, entries }
}

describe('lift ranges', () => {
  test('rangeStart counts back one, three or twelve calendar months', () => {
    expect(new Date(rangeStart('1M', NOW)).getMonth()).toBe(8)
    expect(new Date(rangeStart('3M', NOW)).getMonth()).toBe(6)
    expect(new Date(rangeStart('1Y', NOW)).getFullYear()).toBe(2025)
  })

  test('pointsInRange keeps only the points inside the window, in order', () => {
    const points = [
      { at: NOW.getTime() - 60 * DAY, value: 60 },
      { at: NOW.getTime() - 20 * DAY, value: 66 },
      { at: NOW.getTime() - 2 * DAY, value: 70 },
    ]
    expect(pointsInRange(points, '1M', NOW).map((point) => point.value)).toEqual([66, 70])
    expect(pointsInRange(points, '3M', NOW).map((point) => point.value)).toEqual([60, 66, 70])
  })
})

describe('recordAts', () => {
  test('marks the first point and each point higher than all before it', () => {
    expect(recordAts([
      { at: 1, value: 60 },
      { at: 2, value: 62 },
      { at: 3, value: 61 },
      { at: 4, value: 62 },
      { at: 5, value: 65 },
    ])).toEqual([1, 2, 5])
  })

  test('marks nothing with no points', () => {
    expect(recordAts([])).toEqual([])
  })
})

describe('liftChange', () => {
  test('is the latest value and its change since the first point', () => {
    expect(liftChange([{ at: 10, value: 66.7 }, { at: 20, value: 75 }])).toEqual({ latest: 75, delta: 75 - 66.7, since: 10 })
  })

  test('is null with no points', () => {
    expect(liftChange([])).toBeNull()
  })
})

describe('shortDay', () => {
  test('reads day and month this year, and adds the year otherwise', () => {
    expect(shortDay(new Date(2026, 8, 21).getTime(), NOW)).toBe('21 Sep')
    expect(shortDay(new Date(2025, 8, 21).getTime(), NOW)).toBe('21 Sep 2025')
  })
})

describe('loggedLifts', () => {
  const program: Program = {
    id: 'p',
    name: 'P',
    units: 'kg',
    sessionsPerWeek: 3,
    workouts: [{ id: 'w', name: 'A', exercises: [
      { exerciseId: 'back-squat', sets: 3, repRange: [6, 8], restSeconds: 120 },
      { exerciseId: 'db-bench', sets: 3, repRange: [8, 10], restSeconds: 90 },
    ] }],
  }

  test('lists the logged Exercises in Program order, then the rest by name', () => {
    const sessions = [
      session('s1', 1, [set('curl', 10, 10), set('db-bench', 20, 8), set('push-ups', null, 12), set('back-squat', 60, 8)]),
    ]
    expect(loggedLifts(sessions, [program], (id) => EXERCISES.get(id)).map((exercise) => exercise.name)).toEqual([
      'Back squat', 'DB bench press', 'Curl', 'Push-ups',
    ])
  })

  test('leaves out an Exercise logged only as warm-ups, and one resolve does not answer', () => {
    const sessions = [session('s1', 1, [set('curl', 10, 10, { kind: 'warmup' }), set('ghost', 10, 10), set('back-squat', 60, 8)])]
    expect(loggedLifts(sessions, [program], (id) => EXERCISES.get(id)).map((exercise) => exercise.id)).toEqual(['back-squat'])
  })
})

describe('liftRecords', () => {
  test('a loaded lift tabulates its heaviest set, best estimated 1RM and most reps in a set', () => {
    const d1 = new Date(2026, 8, 30).getTime()
    const d2 = new Date(2026, 9, 13).getTime()
    const sessions = [
      session('s1', d1, [set('back-squat', 50, 12), set('back-squat', 50, 10, { setIndex: 1 })]),
      session('s2', d2, [set('back-squat', 62.5, 8), set('back-squat', 62.5, 7, { setIndex: 1 }), set('back-squat', 40, 5, { kind: 'warmup' })]),
    ]
    expect(liftRecords(squat, sessions)).toEqual([
      { kind: 'heaviest-set', label: 'Heaviest set', best: '62.5 kg × 8', at: d2 },
      { kind: 'best-e1rm', label: 'Best estimated 1RM', best: '79.2 kg', at: d2 },
      { kind: 'most-reps-in-a-set', label: 'Most reps in a set', best: '50 kg × 12', at: d1 },
    ])
  })

  test('most reps in a set ties to the heavier weight', () => {
    const sessions = [session('s1', 1, [set('back-squat', 50, 10), set('back-squat', 55, 10, { setIndex: 1 })])]
    expect(liftRecords(squat, sessions)[2].best).toBe('55 kg × 10')
  })

  test('a bodyweight lift tabulates its reps and, once loaded, its heaviest load and the reps at it', () => {
    const sessions = [
      session('s1', 1, [set('push-ups', null, 15)]),
      session('s2', 2, [set('push-ups', null, 8, { loadKg: 10 })]),
    ]
    expect(liftRecords(pushUps, sessions).map((row) => [row.label, row.best])).toEqual([
      ['Most reps in a set', '15 reps'],
      ['Heaviest load', 'BW+10'],
      ['Most reps at the heaviest load', 'BW+10 × 8'],
    ])
  })

  test('nothing logged tabulates nothing', () => {
    expect(liftRecords(squat, [])).toEqual([])
    expect(liftRecords(pushUps, [])).toEqual([])
  })
})

describe('searchEntries', () => {
  function libraryEntry(id: string, name: string): LibraryExercise {
    return { id, name, force: null, level: 'beginner', mechanic: null, equipment: null, primaryMuscles: ['quadriceps'], secondaryMuscles: [], instructions: [], category: 'strength', images: [] }
  }

  test('lists catalog exercises by their own names first, then every other library exercise once', () => {
    const library = [libraryEntry('Barbell_Squat', 'Barbell Squat'), libraryEntry('Air_Bike', 'Air Bike'), libraryEntry('DB_Bench', 'Dumbbell Bench Press')]
    const catalog = new Map([squat, bench].map((exercise) => [exercise.id, exercise] as const))
    expect(searchEntries(catalog, library).map((entry) => [entry.libraryId, entry.name])).toEqual([
      ['Barbell_Squat', 'Back squat'],
      ['DB_Bench', 'DB bench press'],
      ['Air_Bike', 'Air Bike'],
    ])
  })
})
