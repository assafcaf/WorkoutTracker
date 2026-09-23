import { expect, test } from 'vitest'
import { loadCatalog, loadPrograms } from '../data/catalog'
import { progression, workingAssistance, workingWeight } from './progression'
import type { Exercise, ExercisePlan, SetEntry } from '../types'

// Fixtures come from the bundled catalog and the assaf-ab-2026 program, per the ticket: the
// outcomes name back-squat, assisted-pull-ups and push-ups with their real step, sets and range.
// Expected values are literals checked by hand against the outcome text.
const catalog = loadCatalog()
const programs = loadPrograms(catalog)

function planFor(workoutId: string, exerciseId: string): ExercisePlan {
  const program = programs.find((p) => p.id === 'assaf-ab-2026')
  if (!program) throw new Error('fixture error: no program assaf-ab-2026')
  const workout = program.workouts.find((w) => w.id === workoutId)
  if (!workout) throw new Error(`fixture error: no workout ${workoutId}`)
  const plan = workout.exercises.find((e) => e.exerciseId === exerciseId)
  if (!plan) throw new Error(`fixture error: no plan for ${exerciseId} in ${workoutId}`)
  return plan
}

function exerciseFor(exerciseId: string): Exercise {
  const exercise = catalog.get(exerciseId)
  if (!exercise) throw new Error(`fixture error: no exercise ${exerciseId}`)
  return exercise
}

function sets(exerciseId: string, logged: Array<[number | null, number]>): SetEntry[] {
  return logged.map(([weightKg, reps], i) => ({
    exerciseId,
    setIndex: i + 1,
    weightKg,
    reps,
    loggedAt: 1000 + i,
  }))
}

const squat = exerciseFor('back-squat')
const squatPlan = planFor('workout-a', 'back-squat')
const pullUps = exerciseFor('assisted-pull-ups')
const pullUpsPlan = planFor('workout-b', 'assisted-pull-ups')
const pushUps = exerciseFor('push-ups')
const pushUpsPlan = planFor('workout-a', 'push-ups')

// --- working weight / working assistance ---

test('O1 working weight is the highest logged weight', () => {
  expect(workingWeight(sets('back-squat', [[50, 10], [65, 10], [60, 10]]))).toBe(65)
})

test('O1 working weight ignores sets with no weight', () => {
  expect(workingWeight(sets('back-squat', [[null, 10], [40, 10]]))).toBe(40)
})

test('O1 working weight is null with no entries', () => {
  expect(workingWeight([])).toBeNull()
})

test('O1 working weight is null when no set carries a weight', () => {
  expect(workingWeight(sets('push-ups', [[null, 15], [null, 15]]))).toBeNull()
})

test('O3 working assistance is the lowest logged weight', () => {
  expect(workingAssistance(sets('assisted-pull-ups', [[30, 8], [27, 8], [28, 8]]))).toBe(27)
})

test('O3 working assistance ignores sets with no weight', () => {
  expect(workingAssistance(sets('assisted-pull-ups', [[null, 8], [29, 8]]))).toBe(29)
})

test('O3 working assistance is null with no entries', () => {
  expect(workingAssistance([])).toBeNull()
})

// --- O1: loaded, only the sets at the working weight count ---

test('O1 back-squat 10x50 10x60 10x65 8x65 counts only the two sets at 65 kg', () => {
  const last = sets('back-squat', [[50, 10], [60, 10], [65, 10], [65, 8]])
  const result = progression(squat, squatPlan, last)
  expect(result.workingWeightKg).toBe(65)
  expect(result.targetReps).toBe(20)
  expect(result.achievedReps).toBe(18)
})

test('O1 back-squat with a set short of the top of the range is not full and suggests nothing', () => {
  const last = sets('back-squat', [[50, 10], [60, 10], [65, 10], [65, 8]])
  const result = progression(squat, squatPlan, last)
  expect(result.isFull).toBe(false)
  expect(result.suggestion).toBeNull()
})

test('O1 a single set at the working weight sets the target to one set of top reps', () => {
  const last = sets('back-squat', [[60, 10], [60, 10], [60, 10], [65, 9]])
  const result = progression(squat, squatPlan, last)
  expect(result.workingWeightKg).toBe(65)
  expect(result.targetReps).toBe(10)
  expect(result.achievedReps).toBe(9)
  expect(result.isFull).toBe(false)
})

test('O1 no history gives an empty bar over the planned sets', () => {
  expect(progression(squat, squatPlan, [])).toEqual({
    workingWeightKg: null,
    achievedReps: 0,
    targetReps: 40,
    isFull: false,
    suggestion: null,
  })
})

// --- O2: loaded, full bar ---

test('O2 back-squat with every set at 65 kg reaching 10 reps is full and suggests 67.5 kg', () => {
  const last = sets('back-squat', [[65, 10], [65, 10], [65, 10], [65, 10]])
  expect(progression(squat, squatPlan, last)).toEqual({
    workingWeightKg: 65,
    achievedReps: 40,
    targetReps: 40,
    isFull: true,
    suggestion: { kind: 'add-weight', nextWeightKg: 67.5 },
  })
})

test('O2 lighter warm-up sets short of the top do not stop the working sets filling the bar', () => {
  const last = sets('back-squat', [[50, 8], [60, 9], [65, 10], [65, 10]])
  const result = progression(squat, squatPlan, last)
  expect(result.isFull).toBe(true)
  expect(result.targetReps).toBe(20)
  expect(result.achievedReps).toBe(20)
  expect(result.suggestion).toEqual({ kind: 'add-weight', nextWeightKg: 67.5 })
})

test('O2 a set above the top of the range still counts as reaching it', () => {
  const last = sets('back-squat', [[65, 12], [65, 10]])
  const result = progression(squat, squatPlan, last)
  expect(result.isFull).toBe(true)
  expect(result.achievedReps).toBe(22)
  expect(result.suggestion).toEqual({ kind: 'add-weight', nextWeightKg: 67.5 })
})

test('O2 surplus reps on one set do not make up for a set short of the top', () => {
  // 12 + 8 = 20 reaches the target sum, but the 8 did not reach the top of the range.
  const last = sets('back-squat', [[65, 12], [65, 8]])
  const result = progression(squat, squatPlan, last)
  expect(result.isFull).toBe(false)
  expect(result.suggestion).toBeNull()
})

// --- O3: inverted, less assistance ---

test('O3 assisted-pull-ups with every set at 8 reps on 27 kg suggests reducing assistance to 26 kg', () => {
  const last = sets('assisted-pull-ups', [[27, 8], [27, 8], [27, 8], [27, 8]])
  expect(progression(pullUps, pullUpsPlan, last)).toEqual({
    workingWeightKg: 27,
    achievedReps: 32,
    targetReps: 32,
    isFull: true,
    suggestion: { kind: 'reduce-assistance', nextWeightKg: 26 },
  })
})

test('O3 assisted-pull-ups counts only the sets at the lowest assistance', () => {
  const last = sets('assisted-pull-ups', [[30, 8], [28, 8], [27, 8], [27, 6]])
  const result = progression(pullUps, pullUpsPlan, last)
  expect(result.workingWeightKg).toBe(27)
  expect(result.targetReps).toBe(16)
  expect(result.achievedReps).toBe(14)
  expect(result.isFull).toBe(false)
  expect(result.suggestion).toBeNull()
})

test('O3 heavier-assistance sets short of the top do not stop the working sets filling the bar', () => {
  const last = sets('assisted-pull-ups', [[30, 5], [27, 8], [27, 8]])
  const result = progression(pullUps, pullUpsPlan, last)
  expect(result.isFull).toBe(true)
  expect(result.suggestion).toEqual({ kind: 'reduce-assistance', nextWeightKg: 26 })
})

test('O3 reducing assistance never goes below 0 kg', () => {
  const last = sets('assisted-pull-ups', [[0.5, 8], [0.5, 8]])
  const result = progression(pullUps, pullUpsPlan, last)
  expect(result.suggestion).toEqual({ kind: 'reduce-assistance', nextWeightKg: 0 })
})

test('O3 no history for assisted-pull-ups gives an empty bar over the planned sets', () => {
  expect(progression(pullUps, pullUpsPlan, [])).toEqual({
    workingWeightKg: null,
    achievedReps: 0,
    targetReps: 32,
    isFull: false,
    suggestion: null,
  })
})

// --- O4: bodyweight, add a set ---

test('O4 push-ups 15 15 15 against 10-15 is full and suggests adding a set', () => {
  const last = sets('push-ups', [[null, 15], [null, 15], [null, 15]])
  const result = progression(pushUps, pushUpsPlan, last)
  expect(result.workingWeightKg).toBeNull()
  expect(result.targetReps).toBe(45)
  expect(result.achievedReps).toBe(45)
  expect(result.isFull).toBe(true)
  expect(result.suggestion).toEqual({ kind: 'add-set' })
})

test('O4 the push-ups add-set suggestion carries no weight', () => {
  const last = sets('push-ups', [[null, 15], [null, 15], [null, 15]])
  const result = progression(pushUps, pushUpsPlan, last)
  expect(result.suggestion).not.toBeNull()
  expect(result.suggestion).not.toHaveProperty('nextWeightKg')
})

test('O4 push-ups short of the planned total is not full and suggests nothing', () => {
  const last = sets('push-ups', [[null, 15], [null, 15], [null, 12]])
  const result = progression(pushUps, pushUpsPlan, last)
  expect(result.workingWeightKg).toBeNull()
  expect(result.targetReps).toBe(45)
  expect(result.achievedReps).toBe(42)
  expect(result.isFull).toBe(false)
  expect(result.suggestion).toBeNull()
})

test('O4 push-ups count every entry, so an extra set can make up a short one', () => {
  const last = sets('push-ups', [[null, 15], [null, 15], [null, 10], [null, 10]])
  const result = progression(pushUps, pushUpsPlan, last)
  expect(result.targetReps).toBe(45)
  expect(result.achievedReps).toBe(50)
  expect(result.isFull).toBe(true)
  expect(result.suggestion).toEqual({ kind: 'add-set' })
})

test('O4 no history for push-ups gives an empty bar over the planned sets', () => {
  expect(progression(pushUps, pushUpsPlan, [])).toEqual({
    workingWeightKg: null,
    achievedReps: 0,
    targetReps: 45,
    isFull: false,
    suggestion: null,
  })
})
