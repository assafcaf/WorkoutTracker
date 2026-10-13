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
    libraryId: 'Barbell-Squat',
    ...overrides,
  }
}

const backSquat = exercise({ id: 'back-squat', bodyweight: false })
const pushUps = exercise({ id: 'push-ups', bodyweight: true })
// Assisted is a Bodyweight Exercise with a negative signed Load (E16-T10 removed invertProgress).
const assistedPullUps = exercise({
  id: 'assisted-pull-ups',
  bodyweight: true,
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
  expect(result).not.toHaveProperty('inverted')
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

  expect(result).toEqual({ kind: 'e1rm', points: [] })
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
  expect(result).not.toHaveProperty('inverted')
  expect(result.points).toEqual([{ at: 10, value: 27 }])
})

test('O7 assisted-pull-ups with assistance 32 -> 27 -> 23 kg is marked inverted', () => {
  // Now a load series of signed Loads, rising -32 -> -27 -> -23, and no inverted flag.
  const sessions: Session[] = [
    session({
      id: 's3',
      startedAt: 30,
      entries: [{ exerciseId: 'assisted-pull-ups', setIndex: 1, weightKg: null, reps: 6, loggedAt: 30, loadKg: -23 }],
    }),
    session({
      id: 's2',
      startedAt: 20,
      entries: [{ exerciseId: 'assisted-pull-ups', setIndex: 1, weightKg: null, reps: 6, loggedAt: 20, loadKg: -27 }],
    }),
    session({
      id: 's1',
      startedAt: 10,
      entries: [{ exerciseId: 'assisted-pull-ups', setIndex: 1, weightKg: null, reps: 6, loggedAt: 10, loadKg: -32 }],
    }),
  ]

  const result = seriesFor(assistedPullUps, sessions)

  expect(result).toEqual({
    kind: 'load',
    points: [
      { at: 10, value: -32 },
      { at: 20, value: -27 },
      { at: 30, value: -23 },
    ],
  })
})

test('O7 assistance value is the lowest non-null weightKg in the session, kept positive', () => {
  // Now the highest signed Load in the Session, kept signed: -25 over -28 and -30.
  const sessions: Session[] = [
    session({
      id: 's1',
      startedAt: 10,
      entries: [
        { exerciseId: 'assisted-pull-ups', setIndex: 1, weightKg: null, reps: 6, loggedAt: 10, loadKg: -30 },
        { exerciseId: 'assisted-pull-ups', setIndex: 2, weightKg: null, reps: 5, loggedAt: 10, loadKg: -25 },
        { exerciseId: 'assisted-pull-ups', setIndex: 3, weightKg: null, reps: 6, loggedAt: 10, loadKg: -28 },
      ],
    }),
  ]

  const result = seriesFor(assistedPullUps, sessions)

  expect(result.points).toEqual([{ at: 10, value: -25 }])
})

test('O2 seriesFor ignores warm-up Sets, and a Session of only warm-ups gives no point', () => {
  const sessions = [
    session({
      id: 's1',
      startedAt: 10,
      entries: [
        { exerciseId: 'back-squat', setIndex: 1, weightKg: 200, reps: 20, loggedAt: 10, kind: 'warmup' },
        { exerciseId: 'back-squat', setIndex: 2, weightKg: 60, reps: 0, loggedAt: 11 },
      ],
    }),
    session({
      id: 's2',
      startedAt: 20,
      entries: [
        { exerciseId: 'back-squat', setIndex: 1, weightKg: 200, reps: 20, loggedAt: 20, kind: 'warmup' },
      ],
    }),
  ]
  expect(seriesFor(backSquat, sessions).points).toEqual([{ at: 10, value: 60 }])

  const pushUpSessions = [
    session({
      startedAt: 10,
      entries: [
        { exerciseId: 'push-ups', setIndex: 1, weightKg: null, reps: 30, loggedAt: 10, kind: 'warmup' },
        { exerciseId: 'push-ups', setIndex: 2, weightKg: null, reps: 12, loggedAt: 11 },
      ],
    }),
  ]
  expect(seriesFor(pushUps, pushUpSessions).points).toEqual([{ at: 10, value: 12 }])
})

// --- O19: a Bodyweight Exercise with Loads gets a load series ---

test('O19 a Bodyweight Exercise any of whose Sets carries a Load gets a load series', () => {
  const sessions: Session[] = [
    session({
      id: 's1',
      startedAt: 10,
      entries: [
        { exerciseId: 'push-ups', setIndex: 1, weightKg: null, reps: 12, loggedAt: 10, loadKg: 5 },
        { exerciseId: 'push-ups', setIndex: 2, weightKg: null, reps: 10, loggedAt: 11, loadKg: 10 },
      ],
    }),
  ]

  const result = seriesFor(pushUps, sessions)

  expect(result).toEqual({ kind: 'load', points: [{ at: 10, value: 10 }] })
})

test('O19 a load series point is the highest signed Load of each Session, in date order', () => {
  const sessions: Session[] = [
    session({
      id: 's2',
      startedAt: 20,
      entries: [
        { exerciseId: 'push-ups', setIndex: 1, weightKg: null, reps: 8, loggedAt: 20, loadKg: -27 },
        { exerciseId: 'push-ups', setIndex: 2, weightKg: null, reps: 8, loggedAt: 21, loadKg: -20 },
      ],
    }),
    session({
      id: 's1',
      startedAt: 10,
      entries: [
        { exerciseId: 'push-ups', setIndex: 1, weightKg: null, reps: 8, loggedAt: 10, loadKg: -27 },
      ],
    }),
  ]

  const result = seriesFor(pushUps, sessions)

  expect(result.kind).toBe('load')
  expect(result.points).toEqual([
    { at: 10, value: -27 },
    { at: 20, value: -20 },
  ])
})

test('O19 an Exercise flagged invertProgress with Loads is a load series, not an inverted one', () => {
  const sessions: Session[] = [
    session({
      startedAt: 10,
      entries: [
        { exerciseId: 'assisted-pull-ups', setIndex: 1, weightKg: null, reps: 8, loggedAt: 10, loadKg: -27 },
      ],
    }),
  ]

  const result = seriesFor(assistedPullUps, sessions)

  expect(assistedPullUps).not.toHaveProperty('invertProgress')
  expect(result.kind).toBe('load')
  expect(result).not.toHaveProperty('inverted')
})
