import { expect, test } from 'vitest'
import { recordsFor } from './records'
import type { Exercise, ExercisePlan, Session } from '../types'

// Fixtures built by hand, following src/domain/series.test.ts's convention. Expected numbers
// are literal arithmetic (never calling epley()), hand-checked against the ticket's rules.

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

function plan(overrides: Partial<ExercisePlan>): ExercisePlan {
  return {
    exerciseId: 'back-squat',
    sets: 4,
    repRange: [8, 10],
    restSeconds: 180,
    ...overrides,
  }
}

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

const backSquat = exercise({ id: 'back-squat', bodyweight: false, invertProgress: false })
const squatPlan = plan({ exerciseId: 'back-squat', repRange: [8, 10] })

const assistedPullUps = exercise({
  id: 'assisted-pull-ups',
  bodyweight: false,
  invertProgress: true,
})
const pullUpsPlan = plan({ exerciseId: 'assisted-pull-ups', repRange: [5, 8] })

const pushUps = exercise({ id: 'push-ups', bodyweight: true, invertProgress: false })
const pushUpsPlan = plan({ exerciseId: 'push-ups', repRange: [10, 15] })

// --- Loaded: back-squat ---

test('O9 back-squat records are heaviest-set, best-e1rm and most-reps-at-weight in that order', () => {
  const sessions: Session[] = [
    session({
      id: 's1',
      startedAt: 10,
      entries: [{ exerciseId: 'back-squat', setIndex: 1, weightKg: 60, reps: 8, loggedAt: 10 }],
    }),
  ]

  const result = recordsFor(backSquat, squatPlan, sessions)

  expect(result.map((r) => r.kind)).toEqual(['heaviest-set', 'best-e1rm', 'most-reps-at-weight'])
  expect(result.map((r) => r.label)).toEqual([
    'Heaviest set',
    'Best estimated 1RM',
    'Most reps at the heaviest weight',
  ])
})

test("O9 back-squat heaviest-set is the highest non-null weightKg, dated to that set's session", () => {
  const sessions: Session[] = [
    session({
      id: 's1',
      startedAt: 10,
      entries: [{ exerciseId: 'back-squat', setIndex: 1, weightKg: 100, reps: 1, loggedAt: 10 }],
    }),
    session({
      id: 's2',
      startedAt: 20,
      entries: [{ exerciseId: 'back-squat', setIndex: 1, weightKg: 90, reps: 10, loggedAt: 20 }],
    }),
  ]

  const result = recordsFor(backSquat, squatPlan, sessions)

  expect(result[0]).toEqual({
    kind: 'heaviest-set',
    label: 'Heaviest set',
    value: 100,
    weightKg: 100,
    reps: 1,
    at: 10,
  })
})

test('O9 back-squat best-e1rm is the highest Epley value across every set, not just the heaviest weight', () => {
  const sessions: Session[] = [
    session({
      id: 's1',
      startedAt: 10,
      entries: [{ exerciseId: 'back-squat', setIndex: 1, weightKg: 100, reps: 1, loggedAt: 10 }],
    }),
    session({
      id: 's2',
      startedAt: 20,
      entries: [{ exerciseId: 'back-squat', setIndex: 1, weightKg: 90, reps: 10, loggedAt: 20 }],
    }),
  ]

  const result = recordsFor(backSquat, squatPlan, sessions)

  // 90 * (1 + 10/30) = 120, higher than 100 * (1 + 1/30) even though 100 kg is the heavier set.
  expect(result[1]).toEqual({
    kind: 'best-e1rm',
    label: 'Best estimated 1RM',
    value: 90 * (1 + 10 / 30),
    weightKg: 90,
    reps: 10,
    at: 20,
  })
})

test('O9 back-squat most-reps-at-weight is the most reps logged in one set at the heaviest weight', () => {
  const sessions: Session[] = [
    session({
      id: 's1',
      startedAt: 10,
      entries: [{ exerciseId: 'back-squat', setIndex: 1, weightKg: 100, reps: 1, loggedAt: 10 }],
    }),
    session({
      id: 's2',
      startedAt: 20,
      entries: [{ exerciseId: 'back-squat', setIndex: 1, weightKg: 90, reps: 10, loggedAt: 20 }],
    }),
    session({
      id: 's3',
      startedAt: 30,
      entries: [{ exerciseId: 'back-squat', setIndex: 1, weightKg: 100, reps: 5, loggedAt: 30 }],
    }),
  ]

  const result = recordsFor(backSquat, squatPlan, sessions)

  expect(result[2]).toEqual({
    kind: 'most-reps-at-weight',
    label: 'Most reps at the heaviest weight',
    value: 5,
    weightKg: 100,
    reps: 5,
    at: 30,
  })
})

test('O9 a tie for the heaviest weight goes to the earliest session', () => {
  const sessions: Session[] = [
    session({
      id: 's1',
      startedAt: 50,
      entries: [{ exerciseId: 'back-squat', setIndex: 1, weightKg: 80, reps: 6, loggedAt: 50 }],
    }),
    session({
      id: 's2',
      startedAt: 40,
      entries: [{ exerciseId: 'back-squat', setIndex: 1, weightKg: 80, reps: 9, loggedAt: 40 }],
    }),
  ]

  const result = recordsFor(backSquat, squatPlan, sessions)

  expect(result[0]).toEqual({
    kind: 'heaviest-set',
    label: 'Heaviest set',
    value: 80,
    weightKg: 80,
    reps: 9,
    at: 40,
  })
})

test('O9 back-squat gives no records when no set carries a weight', () => {
  const sessions: Session[] = [
    session({
      id: 's1',
      startedAt: 10,
      entries: [{ exerciseId: 'back-squat', setIndex: 1, weightKg: null, reps: 10, loggedAt: 10 }],
    }),
  ]

  expect(recordsFor(backSquat, squatPlan, sessions)).toEqual([])
})

test('O9 back-squat ignores sets logged for a different exercise', () => {
  const sessions: Session[] = [
    session({
      id: 's1',
      startedAt: 10,
      entries: [{ exerciseId: 'bench-press', setIndex: 1, weightKg: 60, reps: 8, loggedAt: 10 }],
    }),
  ]

  expect(recordsFor(backSquat, squatPlan, sessions)).toEqual([])
})

// --- Inverted: assisted-pull-ups ---

test('O9 assisted-pull-ups gives a lowest-assistance record among sets that reached the target reps', () => {
  const sessions: Session[] = [
    session({
      id: 's1',
      startedAt: 10,
      entries: [
        { exerciseId: 'assisted-pull-ups', setIndex: 1, weightKg: 30, reps: 8, loggedAt: 10 },
      ],
    }),
    session({
      id: 's2',
      startedAt: 20,
      entries: [
        { exerciseId: 'assisted-pull-ups', setIndex: 1, weightKg: 27, reps: 8, loggedAt: 20 },
      ],
    }),
    session({
      id: 's3',
      startedAt: 15,
      entries: [
        { exerciseId: 'assisted-pull-ups', setIndex: 1, weightKg: 25, reps: 6, loggedAt: 15 },
      ],
    }),
  ]

  const result = recordsFor(assistedPullUps, pullUpsPlan, sessions)

  expect(result).toEqual([
    {
      kind: 'lowest-assistance',
      label: 'Lowest assistance at target reps',
      value: 27,
      weightKg: 27,
      reps: 8,
      at: 20,
    },
  ])
})

test('O9 assisted-pull-ups gives no record when no set reaches the target reps', () => {
  const sessions: Session[] = [
    session({
      id: 's1',
      startedAt: 10,
      entries: [
        { exerciseId: 'assisted-pull-ups', setIndex: 1, weightKg: 30, reps: 6, loggedAt: 10 },
      ],
    }),
  ]

  expect(recordsFor(assistedPullUps, pullUpsPlan, sessions)).toEqual([])
})

// --- Bodyweight: push-ups ---

test('O9 push-ups gives a most-reps-in-a-set record with a null weightKg', () => {
  const sessions: Session[] = [
    session({
      id: 's1',
      startedAt: 10,
      entries: [{ exerciseId: 'push-ups', setIndex: 1, weightKg: null, reps: 15, loggedAt: 10 }],
    }),
    session({
      id: 's2',
      startedAt: 20,
      entries: [{ exerciseId: 'push-ups', setIndex: 1, weightKg: null, reps: 20, loggedAt: 20 }],
    }),
  ]

  const result = recordsFor(pushUps, pushUpsPlan, sessions)

  expect(result).toEqual([
    {
      kind: 'most-reps-in-a-set',
      label: 'Most reps in a set',
      value: 20,
      weightKg: null,
      reps: 20,
      at: 20,
    },
  ])
})

test('O9 a tie for most reps in a set goes to the earliest session', () => {
  const sessions: Session[] = [
    session({
      id: 's1',
      startedAt: 30,
      entries: [{ exerciseId: 'push-ups', setIndex: 1, weightKg: null, reps: 18, loggedAt: 30 }],
    }),
    session({
      id: 's2',
      startedAt: 25,
      entries: [{ exerciseId: 'push-ups', setIndex: 1, weightKg: null, reps: 18, loggedAt: 25 }],
    }),
  ]

  const result = recordsFor(pushUps, pushUpsPlan, sessions)

  expect(result[0].at).toBe(25)
})

// --- Empty history ---

test('O9 an empty session history gives no records', () => {
  expect(recordsFor(backSquat, squatPlan, [])).toEqual([])
})
