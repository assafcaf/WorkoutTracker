import { expect, test } from 'vitest'
import { epley, seriesFor } from './series'
import type { Exercise, Session } from '../types'

function exercise(overrides: Partial<Exercise>): Exercise {
  return {
    id: 'back-squat',
    name: 'Back Squat',
    weightStep: 2.5,
    startWeight: 50,
    bodyweight: false,
    invertProgress: false,
    libraryId: 'Barbell-Squat',
    ...overrides,
  }
}

const backSquat = exercise({ id: 'back-squat', bodyweight: false, invertProgress: false })
const pushUps = exercise({ id: 'push-ups', bodyweight: true, invertProgress: false })
const assistedPullUps = exercise({
  id: 'assisted-pull-ups',
  bodyweight: false,
  invertProgress: true,
})

function session(overrides: Partial<Session>): Session {
  return {
    id: 'session-1',
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt: 1,
    finishedAt: 2,
    entries: [],
    ...overrides,
  }
}

test('epley O5 returns the unrounded Epley estimate for a weight and rep count', () => {
  expect(epley(100, 5)).toBeCloseTo(100 * (1 + 5 / 30))
})

test("O5 each e1RM point is the session's highest Epley value across that session's sets", () => {
  const sessions: Session[] = [
    session({
      id: 's1',
      startedAt: 10,
      entries: [
        { exerciseId: 'back-squat', setIndex: 1, weightKg: 100, reps: 5, loggedAt: 10 },
        { exerciseId: 'back-squat', setIndex: 2, weightKg: 90, reps: 8, loggedAt: 10 },
      ],
    }),
  ]

  const result = seriesFor(backSquat, sessions)

  expect(result.kind).toBe('e1rm')
  expect(result.inverted).toBe(false)
  expect(result.points).toEqual([{ at: 10, value: Math.max(100 * (1 + 5 / 30), 90 * (1 + 8 / 30)) }])
})

test('O5 e1RM points come back sorted ascending by session startedAt from newest-first input', () => {
  const sessions: Session[] = [
    session({
      id: 's2',
      startedAt: 20,
      entries: [{ exerciseId: 'back-squat', setIndex: 1, weightKg: 80, reps: 5, loggedAt: 20 }],
    }),
    session({
      id: 's1',
      startedAt: 10,
      entries: [{ exerciseId: 'back-squat', setIndex: 1, weightKg: 70, reps: 5, loggedAt: 10 }],
    }),
  ]

  const result = seriesFor(backSquat, sessions)

  expect(result.points.map((p) => p.at)).toEqual([10, 20])
})

test('O5 a null weightKg set is skipped when finding the highest Epley value', () => {
  const sessions: Session[] = [
    session({
      id: 's1',
      startedAt: 10,
      entries: [
        { exerciseId: 'back-squat', setIndex: 1, weightKg: null, reps: 20, loggedAt: 10 },
        { exerciseId: 'back-squat', setIndex: 2, weightKg: 60, reps: 5, loggedAt: 10 },
      ],
    }),
  ]

  const result = seriesFor(backSquat, sessions)

  expect(result.points).toEqual([{ at: 10, value: 60 * (1 + 5 / 30) }])
})

test('O5 a session with only null-weightKg sets for the exercise gives no point', () => {
  const sessions: Session[] = [
    session({
      id: 's1',
      startedAt: 10,
      entries: [{ exerciseId: 'back-squat', setIndex: 1, weightKg: null, reps: 5, loggedAt: 10 }],
    }),
  ]

  const result = seriesFor(backSquat, sessions)

  expect(result.points).toEqual([])
})

test('O5 no matching session gives an empty points series', () => {
  const sessions: Session[] = [
    session({
      id: 's1',
      startedAt: 10,
      entries: [{ exerciseId: 'bench-press', setIndex: 1, weightKg: 60, reps: 5, loggedAt: 10 }],
    }),
  ]

  const result = seriesFor(backSquat, sessions)

  expect(result).toEqual({ kind: 'e1rm', inverted: false, points: [] })
})

test('O6 push-ups produces no e1RM series and a reps-per-session series instead', () => {
  const sessions: Session[] = [
    session({
      id: 's1',
      startedAt: 10,
      entries: [
        { exerciseId: 'push-ups', setIndex: 1, weightKg: null, reps: 15, loggedAt: 10 },
        { exerciseId: 'push-ups', setIndex: 2, weightKg: null, reps: 12, loggedAt: 10 },
      ],
    }),
  ]

  const result = seriesFor(pushUps, sessions)

  expect(result.kind).toBe('reps')
  expect(result.inverted).toBe(false)
  expect(result.points).toEqual([{ at: 10, value: 27 }])
})

test('O7 assisted-pull-ups with assistance 32 -> 27 -> 23 kg is marked inverted', () => {
  const sessions: Session[] = [
    session({
      id: 's3',
      startedAt: 30,
      entries: [{ exerciseId: 'assisted-pull-ups', setIndex: 1, weightKg: 23, reps: 6, loggedAt: 30 }],
    }),
    session({
      id: 's2',
      startedAt: 20,
      entries: [{ exerciseId: 'assisted-pull-ups', setIndex: 1, weightKg: 27, reps: 6, loggedAt: 20 }],
    }),
    session({
      id: 's1',
      startedAt: 10,
      entries: [{ exerciseId: 'assisted-pull-ups', setIndex: 1, weightKg: 32, reps: 6, loggedAt: 10 }],
    }),
  ]

  const result = seriesFor(assistedPullUps, sessions)

  expect(result.kind).toBe('assistance')
  expect(result.inverted).toBe(true)
  expect(result.points).toEqual([
    { at: 10, value: 32 },
    { at: 20, value: 27 },
    { at: 30, value: 23 },
  ])
})

test('O7 assistance value is the lowest non-null weightKg in the session, kept positive', () => {
  const sessions: Session[] = [
    session({
      id: 's1',
      startedAt: 10,
      entries: [
        { exerciseId: 'assisted-pull-ups', setIndex: 1, weightKg: 30, reps: 6, loggedAt: 10 },
        { exerciseId: 'assisted-pull-ups', setIndex: 2, weightKg: null, reps: 6, loggedAt: 10 },
        { exerciseId: 'assisted-pull-ups', setIndex: 3, weightKg: 25, reps: 5, loggedAt: 10 },
      ],
    }),
  ]

  const result = seriesFor(assistedPullUps, sessions)

  expect(result.points).toEqual([{ at: 10, value: 25 }])
})
