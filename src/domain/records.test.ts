import { expect, test } from 'vitest'
import { recordsFor, recordsSetBy } from './records'
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

// --- recordsSetBy (E13-T3) ---

const set = (exerciseId: string, weightKg: number | null, reps: number, loggedAt: number) => ({
  exerciseId,
  setIndex: 1,
  weightKg,
  reps,
  loggedAt,
})

test('O13 a Set heavier than anything before sets the heaviest-set record and whichever other records it changes', () => {
  const earlier = [session({ id: 'e1', startedAt: 10, entries: [set('back-squat', 60, 8, 10)] })]
  const entry = set('back-squat', 70, 5, 105)
  const current = session({ id: 'cur', startedAt: 100, finishedAt: null, entries: [entry] })

  const result = recordsSetBy(backSquat, squatPlan, earlier, current, entry)

  // 70 * (1 + 5/30) = 81.67 beats 60 * (1 + 8/30) = 76; reps at the new heaviest weight is 5.
  expect(result).toEqual([
    { kind: 'heaviest-set', label: 'Heaviest set', value: 70, weightKg: 70, reps: 5, at: 100 },
    {
      kind: 'best-e1rm',
      label: 'Best estimated 1RM',
      value: 70 * (1 + 5 / 30),
      weightKg: 70,
      reps: 5,
      at: 100,
    },
    {
      kind: 'most-reps-at-weight',
      label: 'Most reps at the heaviest weight',
      value: 5,
      weightKg: 70,
      reps: 5,
      at: 100,
    },
  ])
})

test('O13 a lighter Set with a better estimated 1RM answers only best-e1rm', () => {
  const earlier = [session({ id: 'e1', startedAt: 10, entries: [set('back-squat', 100, 1, 10)] })]
  const entry = set('back-squat', 90, 10, 105)
  const current = session({ id: 'cur', startedAt: 100, finishedAt: null, entries: [entry] })

  const result = recordsSetBy(backSquat, squatPlan, earlier, current, entry)

  expect(result.map((r) => r.kind)).toEqual(['best-e1rm'])
  expect(result[0].weightKg).toBe(90)
  expect(result[0].reps).toBe(10)
})

test('O13 more reps at the same heaviest weight answers best-e1rm and most-reps-at-weight, not heaviest-set', () => {
  const earlier = [session({ id: 'e1', startedAt: 10, entries: [set('back-squat', 100, 3, 10)] })]
  const entry = set('back-squat', 100, 5, 105)
  const current = session({ id: 'cur', startedAt: 100, finishedAt: null, entries: [entry] })

  const result = recordsSetBy(backSquat, squatPlan, earlier, current, entry)

  expect(result.map((r) => r.kind)).toEqual(['best-e1rm', 'most-reps-at-weight'])
})

test('O13 a new heaviest Set with fewer reps still answers most-reps-at-weight, because that record moves with the heaviest weight', () => {
  const earlier = [session({ id: 'e1', startedAt: 10, entries: [set('back-squat', 60, 10, 10)] })]
  const entry = set('back-squat', 70, 2, 105)
  const current = session({ id: 'cur', startedAt: 100, finishedAt: null, entries: [entry] })

  const result = recordsSetBy(backSquat, squatPlan, earlier, current, entry)

  // e1rm: 70 * (1 + 2/30) = 74.67 < 60 * (1 + 10/30) = 80, so best-e1rm is unchanged.
  expect(result.map((r) => r.kind)).toEqual(['heaviest-set', 'most-reps-at-weight'])
  expect(result[1].value).toBe(2)
})

test('O13 a Set that ties the existing records answers nothing', () => {
  const earlier = [session({ id: 'e1', startedAt: 10, entries: [set('back-squat', 80, 6, 10)] })]
  const entry = set('back-squat', 80, 6, 105)
  const current = session({ id: 'cur', startedAt: 100, finishedAt: null, entries: [entry] })

  expect(recordsSetBy(backSquat, squatPlan, earlier, current, entry)).toEqual([])
})

test('O13 a Set below the existing records answers nothing', () => {
  const earlier = [session({ id: 'e1', startedAt: 10, entries: [set('back-squat', 80, 6, 10)] })]
  const entry = set('back-squat', 70, 5, 105)
  const current = session({ id: 'cur', startedAt: 100, finishedAt: null, entries: [entry] })

  expect(recordsSetBy(backSquat, squatPlan, earlier, current, entry)).toEqual([])
})

test('O13 the first-ever Session of an Exercise has no earlier Session, so its Sets set no records', () => {
  const entry = set('back-squat', 70, 5, 105)
  const current = session({ id: 'cur', startedAt: 100, finishedAt: null, entries: [entry] })

  expect(recordsSetBy(backSquat, squatPlan, [], current, entry)).toEqual([])
})

test('O13 earlier Sessions that hold only other Exercises count as no earlier Session for this one', () => {
  const earlier = [session({ id: 'e1', startedAt: 10, entries: [set('bench-press', 60, 8, 10)] })]
  const entry = set('back-squat', 70, 5, 105)
  const current = session({ id: 'cur', startedAt: 100, finishedAt: null, entries: [entry] })

  expect(recordsSetBy(backSquat, squatPlan, earlier, current, entry)).toEqual([])
})

test("O13 this Session's earlier Sets count as logged before: a repeat of them ties and sets nothing", () => {
  const earlier = [session({ id: 'e1', startedAt: 10, entries: [set('back-squat', 60, 8, 10)] })]
  const first = set('back-squat', 70, 5, 105)
  const second = { ...set('back-squat', 70, 5, 205), setIndex: 2 }
  const current = session({
    id: 'cur',
    startedAt: 100,
    finishedAt: null,
    entries: [first, second],
  })

  expect(recordsSetBy(backSquat, squatPlan, earlier, current, second)).toEqual([])
  expect(recordsSetBy(backSquat, squatPlan, earlier, current, first).length).toBeGreaterThan(0)
})

test("O13 this Session's later Sets do not count as logged before", () => {
  const earlier = [session({ id: 'e1', startedAt: 10, entries: [set('back-squat', 60, 8, 10)] })]
  const first = set('back-squat', 70, 5, 105)
  const later = { ...set('back-squat', 100, 5, 205), setIndex: 2 }
  const current = session({ id: 'cur', startedAt: 100, finishedAt: null, entries: [later, first] })

  const result = recordsSetBy(backSquat, squatPlan, earlier, current, first)

  expect(result.map((r) => r.kind)).toEqual(['heaviest-set', 'best-e1rm', 'most-reps-at-weight'])
  expect(result[0].weightKg).toBe(70)
})

test('O13 an assisted Exercise sets lowest-assistance only with less assistance at the target reps', () => {
  const earlier = [
    session({ id: 'e1', startedAt: 10, entries: [set('assisted-pull-ups', 27, 8, 10)] }),
  ]
  const better = set('assisted-pull-ups', 25, 8, 105)
  const tie = set('assisted-pull-ups', 27, 8, 105)
  const belowTarget = set('assisted-pull-ups', 20, 5, 105)
  const cur = (entry: ReturnType<typeof set>) =>
    session({ id: 'cur', startedAt: 100, finishedAt: null, entries: [entry] })

  const result = recordsSetBy(assistedPullUps, pullUpsPlan, earlier, cur(better), better)

  expect(result).toEqual([
    {
      kind: 'lowest-assistance',
      label: 'Lowest assistance at target reps',
      value: 25,
      weightKg: 25,
      reps: 8,
      at: 100,
    },
  ])
  expect(recordsSetBy(assistedPullUps, pullUpsPlan, earlier, cur(tie), tie)).toEqual([])
  expect(
    recordsSetBy(assistedPullUps, pullUpsPlan, earlier, cur(belowTarget), belowTarget),
  ).toEqual([])
})

test('O13 a bodyweight Exercise sets most-reps-in-a-set only with more reps, a tie sets nothing', () => {
  const earlier = [session({ id: 'e1', startedAt: 10, entries: [set('push-ups', null, 15, 10)] })]
  const more = set('push-ups', null, 16, 105)
  const tie = set('push-ups', null, 15, 105)
  const cur = (entry: ReturnType<typeof set>) =>
    session({ id: 'cur', startedAt: 100, finishedAt: null, entries: [entry] })

  expect(recordsSetBy(pushUps, pushUpsPlan, earlier, cur(more), more)).toEqual([
    {
      kind: 'most-reps-in-a-set',
      label: 'Most reps in a set',
      value: 16,
      weightKg: null,
      reps: 16,
      at: 100,
    },
  ])
  expect(recordsSetBy(pushUps, pushUpsPlan, earlier, cur(tie), tie)).toEqual([])
})

test('O2 recordsFor ignores warm-up Sets that would otherwise win every record', () => {
  const withWarmups = [
    session({
      startedAt: 100,
      entries: [
        { exerciseId: 'back-squat', setIndex: 1, weightKg: 200, reps: 20, loggedAt: 100, kind: 'warmup' },
        { exerciseId: 'back-squat', setIndex: 2, weightKg: 60, reps: 8, loggedAt: 101 },
        { exerciseId: 'back-squat', setIndex: 3, weightKg: 60, reps: 9, loggedAt: 102, kind: 'drop' },
      ],
    }),
  ]
  const without = [
    session({
      startedAt: 100,
      entries: [
        { exerciseId: 'back-squat', setIndex: 2, weightKg: 60, reps: 8, loggedAt: 101 },
        { exerciseId: 'back-squat', setIndex: 3, weightKg: 60, reps: 9, loggedAt: 102, kind: 'drop' },
      ],
    }),
  ]
  const result = recordsFor(backSquat, squatPlan, withWarmups)
  expect(result).toEqual(recordsFor(backSquat, squatPlan, without))
  expect(result.find((r) => r.kind === 'heaviest-set')?.weightKg).toBe(60)
  expect(recordsFor(backSquat, squatPlan, [
    session({
      entries: [
        { exerciseId: 'back-squat', setIndex: 1, weightKg: 200, reps: 20, loggedAt: 1, kind: 'warmup' },
      ],
    }),
  ])).toEqual([])
})

// --- O16: Load records on a Bodyweight Exercise ---

test('O16 a loaded Bodyweight Exercise adds heaviest-load and most-reps-at-load', () => {
  const sessions = [
    session({
      startedAt: 100,
      entries: [
        { exerciseId: 'push-ups', setIndex: 1, weightKg: null, reps: 15, loggedAt: 1 },
        { exerciseId: 'push-ups', setIndex: 2, weightKg: null, reps: 8, loggedAt: 2, loadKg: 10 },
        { exerciseId: 'push-ups', setIndex: 3, weightKg: null, reps: 11, loggedAt: 3, loadKg: 10 },
      ],
    }),
    session({
      startedAt: 200,
      entries: [
        { exerciseId: 'push-ups', setIndex: 1, weightKg: null, reps: 5, loggedAt: 4, loadKg: 15 },
        { exerciseId: 'push-ups', setIndex: 2, weightKg: null, reps: 7, loggedAt: 5, loadKg: 15 },
      ],
    }),
  ]
  const records = recordsFor(pushUps, pushUpsPlan, sessions)

  expect(records.find((r) => r.kind === 'heaviest-load')).toMatchObject({
    label: 'Heaviest load',
    value: 15,
    reps: 5,
    at: 200,
  })
  expect(records.find((r) => r.kind === 'most-reps-at-load')).toMatchObject({
    label: 'Most reps at the heaviest load',
    value: 7,
    reps: 7,
    at: 200,
  })
  // the existing record stays, reps-only
  expect(records.find((r) => r.kind === 'most-reps-in-a-set')).toMatchObject({ value: 15, at: 100 })
})

test('O16 a Bodyweight Exercise with no loaded Set, or only load 0, answers only most-reps-in-a-set', () => {
  const sessions = [
    session({
      startedAt: 100,
      entries: [
        { exerciseId: 'push-ups', setIndex: 1, weightKg: null, reps: 12, loggedAt: 1 },
        { exerciseId: 'push-ups', setIndex: 2, weightKg: null, reps: 9, loggedAt: 2, loadKg: 0 },
      ],
    }),
  ]
  const records = recordsFor(pushUps, pushUpsPlan, sessions)
  expect(records.map((r) => r.kind)).toEqual(['most-reps-in-a-set'])
  expect(records[0].value).toBe(12)
})

test('O16 warm-up Sets with a load do not set a load record', () => {
  const sessions = [
    session({
      entries: [
        { exerciseId: 'push-ups', setIndex: 1, weightKg: null, reps: 5, loggedAt: 1, loadKg: 40, kind: 'warmup' },
        { exerciseId: 'push-ups', setIndex: 2, weightKg: null, reps: 10, loggedAt: 2, loadKg: 5 },
      ],
    }),
  ]
  const records = recordsFor(pushUps, pushUpsPlan, sessions)
  expect(records.find((r) => r.kind === 'heaviest-load')?.value).toBe(5)
})
