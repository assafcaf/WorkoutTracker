import { expect, test } from 'vitest'
import { normalizeLegacySession, normalizeLegacySet } from './legacySets'
import type { Session, SetEntry } from '../types'

// An assisted pull-up logged before E16 stored its assistance as a positive `weightKg`. The
// Bodyweight shape stores it as `weightKg: null` and a negative Load.
function pullUp(over: Partial<SetEntry> = {}): SetEntry {
  return { exerciseId: 'assisted-pull-ups', setIndex: 1, weightKg: 27, reps: 8, loggedAt: 1_000, ...over }
}

test('O14 a stored assisted pull-up at weightKg 27 reads as weightKg null with Load -27', () => {
  expect(normalizeLegacySet(pullUp())).toEqual({
    exerciseId: 'assisted-pull-ups',
    setIndex: 1,
    weightKg: null,
    reps: 8,
    loggedAt: 1_000,
    loadKg: -27,
  })
})

test('O14 any positive assisted pull-up weight becomes the same Load, negated', () => {
  expect(normalizeLegacySet(pullUp({ weightKg: 20 }))).toMatchObject({ weightKg: null, loadKg: -20 })
  expect(normalizeLegacySet(pullUp({ weightKg: 32.5 }))).toMatchObject({ weightKg: null, loadKg: -32.5 })
})

test('O14 normalising keeps every other field of the Set unchanged', () => {
  const stored = pullUp({ setIndex: 3, reps: 6, loggedAt: 9_000, kind: 'failure', rir: 0, restSeconds: 120 })

  expect(normalizeLegacySet(stored)).toEqual({
    exerciseId: 'assisted-pull-ups',
    setIndex: 3,
    weightKg: null,
    reps: 6,
    loggedAt: 9_000,
    kind: 'failure',
    rir: 0,
    restSeconds: 120,
    loadKg: -27,
  })
})

test('O14 a stored assisted pull-up at weightKg 0 reads as plain BW with no loadKg', () => {
  const normalised = normalizeLegacySet(pullUp({ weightKg: 0 }))

  expect(normalised).toEqual({
    exerciseId: 'assisted-pull-ups',
    setIndex: 1,
    weightKg: null,
    reps: 8,
    loggedAt: 1_000,
  })
  expect('loadKg' in normalised).toBe(false)
})

test('O14 an assisted pull-up already in Bodyweight shape with a Load comes back as it was', () => {
  const already = pullUp({ weightKg: null, loadKg: -27 })

  expect(normalizeLegacySet(already)).toEqual({
    exerciseId: 'assisted-pull-ups',
    setIndex: 1,
    weightKg: null,
    reps: 8,
    loggedAt: 1_000,
    loadKg: -27,
  })
})

test('O14 a plain Bodyweight assisted pull-up with no Load comes back as it was', () => {
  const plain = pullUp({ weightKg: null })

  const normalised = normalizeLegacySet(plain)

  expect(normalised).toEqual({ exerciseId: 'assisted-pull-ups', setIndex: 1, weightKg: null, reps: 8, loggedAt: 1_000 })
  expect('loadKg' in normalised).toBe(false)
})

test('O14 a Set of any other Exercise with a weight comes back as it was', () => {
  const squat: SetEntry = { exerciseId: 'back-squat', setIndex: 2, weightKg: 27, reps: 5, loggedAt: 2_000 }
  const pushUp: SetEntry = { exerciseId: 'push-ups', setIndex: 1, weightKg: null, reps: 12, loggedAt: 3_000, loadKg: 10 }

  expect(normalizeLegacySet(squat)).toEqual({ exerciseId: 'back-squat', setIndex: 2, weightKg: 27, reps: 5, loggedAt: 2_000 })
  expect(normalizeLegacySet(pushUp)).toEqual({
    exerciseId: 'push-ups',
    setIndex: 1,
    weightKg: null,
    reps: 12,
    loggedAt: 3_000,
    loadKg: 10,
  })
})

test('O14 normalising twice answers the same as normalising once', () => {
  for (const stored of [pullUp(), pullUp({ weightKg: 0 }), pullUp({ weightKg: null, loadKg: -15 })]) {
    const once = normalizeLegacySet(stored)
    expect(normalizeLegacySet(once)).toEqual(once)
  }
  expect(normalizeLegacySet(normalizeLegacySet(pullUp()))).toEqual(normalizeLegacySet(pullUp()))
  expect(normalizeLegacySet(normalizeLegacySet(pullUp()))).toMatchObject({ weightKg: null, loadKg: -27 })
})

test('O14 normalising does not change the Set it was given', () => {
  const stored = pullUp()

  normalizeLegacySet(stored)

  expect(stored).toEqual({ exerciseId: 'assisted-pull-ups', setIndex: 1, weightKg: 27, reps: 8, loggedAt: 1_000 })
})

function session(entries: SetEntry[]): Session {
  return {
    id: 'old',
    programId: 'assaf-ab-2026',
    workoutId: 'workout-b',
    startedAt: 100,
    finishedAt: 5_000,
    entries,
    swaps: { 'machine-row': 'cable-row' },
    updatedAt: 6_000,
    note: 'tired',
  }
}

test('O14 normalizeLegacySession normalises every Set and keeps the Session fields, updatedAt included', () => {
  const deadlift: SetEntry = { exerciseId: 'deadlift', setIndex: 1, weightKg: 80, reps: 8, loggedAt: 900 }
  const stored = session([deadlift, pullUp({ setIndex: 1 }), pullUp({ setIndex: 2, weightKg: 0, loggedAt: 1_100 })])

  expect(normalizeLegacySession(stored)).toEqual({
    id: 'old',
    programId: 'assaf-ab-2026',
    workoutId: 'workout-b',
    startedAt: 100,
    finishedAt: 5_000,
    entries: [
      { exerciseId: 'deadlift', setIndex: 1, weightKg: 80, reps: 8, loggedAt: 900 },
      { exerciseId: 'assisted-pull-ups', setIndex: 1, weightKg: null, reps: 8, loggedAt: 1_000, loadKg: -27 },
      { exerciseId: 'assisted-pull-ups', setIndex: 2, weightKg: null, reps: 8, loggedAt: 1_100 },
    ],
    swaps: { 'machine-row': 'cable-row' },
    updatedAt: 6_000,
    note: 'tired',
  })
})

test('O14 normalizeLegacySession of a Session with no Sets answers it as it was', () => {
  expect(normalizeLegacySession(session([]))).toEqual({
    id: 'old',
    programId: 'assaf-ab-2026',
    workoutId: 'workout-b',
    startedAt: 100,
    finishedAt: 5_000,
    entries: [],
    swaps: { 'machine-row': 'cable-row' },
    updatedAt: 6_000,
    note: 'tired',
  })
})
