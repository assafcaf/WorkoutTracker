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

// --- O3: assisted is a negative signed Load on a Bodyweight Exercise ---

// Assisted pull-ups are a Bodyweight Exercise at a negative signed Load (E16-T10).
const assistedPullUps: Exercise = { ...pullUps, bodyweight: true }

function assisted(logged: Array<[number, number]>): SetEntry[] {
  return logged.map(([loadKg, reps], i) => ({
    exerciseId: 'assisted-pull-ups',
    setIndex: i + 1,
    weightKg: null,
    reps,
    loggedAt: 1000 + i,
    loadKg,
  }))
}

test('O3 assisted-pull-ups with every set at 8 reps on 27 kg suggests reducing assistance to 26 kg', () => {
  // BW-27 x 8 four times, full -> add-load to BW-26 (weightStep 1).
  const last = assisted([[-27, 8], [-27, 8], [-27, 8], [-27, 8]])
  expect(progression(assistedPullUps, pullUpsPlan, last)).toEqual({
    workingWeightKg: null,
    achievedReps: 32,
    targetReps: 32,
    isFull: true,
    suggestion: { kind: 'add-load', nextLoadKg: -26 },
  })
})

test('O3 assisted-pull-ups counts only the sets at the lowest assistance', () => {
  // The lowest assistance is the highest signed Load, BW-27.
  const last = assisted([[-30, 8], [-28, 8], [-27, 8], [-27, 6]])
  const result = progression(assistedPullUps, pullUpsPlan, last)
  expect(result.targetReps).toBe(16)
  expect(result.achievedReps).toBe(14)
  expect(result.isFull).toBe(false)
  expect(result.suggestion).toBeNull()
})

test('O3 heavier-assistance sets short of the top do not stop the working sets filling the bar', () => {
  const last = assisted([[-30, 5], [-27, 8], [-27, 8]])
  const result = progression(assistedPullUps, pullUpsPlan, last)
  expect(result.isFull).toBe(true)
  expect(result.suggestion).toEqual({ kind: 'add-load', nextLoadKg: -26 })
})

test('O3 reducing assistance never goes below 0 kg', () => {
  // A signed Load has no floor at 0: BW-0.5 full -> BW+0.5, an added Load.
  const last = assisted([[-0.5, 8], [-0.5, 8]])
  const result = progression(assistedPullUps, pullUpsPlan, last)
  expect(result.suggestion).toEqual({ kind: 'add-load', nextLoadKg: 0.5 })
})

test('O3 no history for assisted-pull-ups gives an empty bar over the planned sets', () => {
  expect(progression(assistedPullUps, pullUpsPlan, [])).toEqual({
    workingWeightKg: null,
    achievedReps: 0,
    targetReps: 32,
    isFull: false,
    suggestion: null,
  })
})

// --- O18: no inverted rule left in progression ---

test('O18 a loaded Exercise flagged invertProgress still adds weight from its highest weight', () => {
  // No Exercise carries invertProgress any more (E16-T10): a loaded Exercise adds weight from
  // its highest weight. back-squat 65 x 10 twice, top of 8-10 reached -> add-weight 67.5.
  const last = sets('back-squat', [[60, 10], [65, 10], [65, 10]])
  const result = progression(squat, squatPlan, last)
  expect(squat).not.toHaveProperty('invertProgress')
  expect(result.workingWeightKg).toBe(65)
  expect(result.suggestion).toEqual({ kind: 'add-weight', nextWeightKg: 67.5 })
})

test('O18 a loaded Exercise flagged invertProgress counts only the sets at its highest weight', () => {
  // No Exercise carries invertProgress any more (E16-T10); only the sets at 65 count.
  const last = sets('back-squat', [[50, 6], [65, 10], [65, 10]])
  const result = progression(squat, squatPlan, last)
  expect(result.achievedReps).toBe(20)
  expect(result.targetReps).toBe(20)
  expect(result.isFull).toBe(true)
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

test('O2 progression answers as if the warm-up Sets were not in the last entries', () => {
  const squat = exerciseFor('back-squat')
  const working = sets('back-squat', [
    [60, 8],
    [60, 8],
  ])
  const withWarmups: SetEntry[] = [
    { ...sets('back-squat', [[100, 1]])[0], kind: 'warmup' },
    ...working,
  ]
  const result = progression(squat, squatPlan, withWarmups)
  expect(result).toEqual(progression(squat, squatPlan, working))
  expect(result.workingWeightKg).toBe(60)

  const onlyWarmups = withWarmups.slice(0, 1)
  expect(progression(squat, squatPlan, onlyWarmups)).toEqual(progression(squat, squatPlan, []))

  const bodyweight: SetEntry[] = [
    { ...sets('push-ups', [[null, 50]])[0], kind: 'warmup' },
    ...sets('push-ups', [[null, 10]]),
  ]
  expect(progression(pushUps, pushUpsPlan, bodyweight).achievedReps).toBe(10)
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

// --- O16: progression at the highest load ---

const weightedPushUps: Exercise = { ...pushUps, weightStep: 2.5 }

function loaded(logged: Array<[number | undefined, number]>): SetEntry[] {
  return logged.map(([loadKg, reps], i) => ({
    exerciseId: 'push-ups',
    setIndex: i + 1,
    weightKg: null,
    reps,
    loggedAt: 1000 + i,
    ...(loadKg === undefined ? {} : { loadKg }),
  }))
}

test('O16 push-ups full at the highest load suggest add-load of load plus weightStep', () => {
  // range 10-15: both sets at load 10 reach 15; the lighter set at 5 is ignored
  const last = loaded([[5, 8], [10, 15], [10, 15]])
  const result = progression(weightedPushUps, pushUpsPlan, last)
  expect(result.isFull).toBe(true)
  expect(result.achievedReps).toBe(30)
  expect(result.targetReps).toBe(30)
  expect(result.suggestion).toEqual({ kind: 'add-load', nextLoadKg: 12.5 })
})

test('O16 push-ups short of the top reps at the highest load suggest nothing', () => {
  const last = loaded([[5, 15], [10, 15], [10, 12]])
  const result = progression(weightedPushUps, pushUpsPlan, last)
  expect(result.isFull).toBe(false)
  expect(result.achievedReps).toBe(27)
  expect(result.targetReps).toBe(30)
  expect(result.suggestion).toBeNull()
})

test('O16 push-ups with no loaded Set, or only load 0, still answer by the whole plan and add-set', () => {
  const noLoad = loaded([[undefined, 15], [undefined, 15], [undefined, 15]])
  const zeroLoad = loaded([[0, 15], [0, 15], [0, 15]])
  for (const last of [noLoad, zeroLoad]) {
    const result = progression(weightedPushUps, pushUpsPlan, last)
    expect(result.targetReps).toBe(45)
    expect(result.achievedReps).toBe(45)
    expect(result.suggestion).toEqual({ kind: 'add-set' })
  }
})

// --- E21-T1 O2: effort moves the suggestion ---

type Rir = 0 | 1 | 2 | 3 | undefined
const withRir = (entries: SetEntry[], rirs: Rir[]): SetEntry[] =>
  entries.map((entry, i) => (rirs[i] === undefined ? entry : { ...entry, rir: rirs[i] }))

test('O2 a full loaded bar at 60 kg with RIRs 2, 3, 2 suggests add-weight 65', () => {
  const last = withRir(sets('back-squat', [[60, 10], [60, 10], [60, 10]]), [2, 3, 2])
  const result = progression(squat, squatPlan, last)
  expect(result.suggestion).toEqual({ kind: 'add-weight', nextWeightKg: 65 })
})

test('O2 a full loaded bar at 60 kg with RIRs 0, 0, 0 holds at 60 and is still full', () => {
  const last = withRir(sets('back-squat', [[60, 10], [60, 10], [60, 10]]), [0, 0, 0])
  const result = progression(squat, squatPlan, last)
  expect(result.isFull).toBe(true)
  expect(result.workingWeightKg).toBe(60)
  expect(result.suggestion).toEqual({ kind: 'hold', nextWeightKg: 60 })
})

test('O2 a full loaded bar with no RIR or a mixed RIR suggests 62.5', () => {
  const none = sets('back-squat', [[60, 10], [60, 10], [60, 10]])
  expect(progression(squat, squatPlan, none).suggestion).toEqual({ kind: 'add-weight', nextWeightKg: 62.5 })
  const mixed = withRir(none, [2, 1, 2])
  expect(progression(squat, squatPlan, mixed).suggestion).toEqual({ kind: 'add-weight', nextWeightKg: 62.5 })
  const partial = withRir(none, [3, 3, undefined])
  expect(progression(squat, squatPlan, partial).suggestion).toEqual({ kind: 'add-weight', nextWeightKg: 62.5 })
})

test('O2 effort reads only the working-weight Sets of the bar, not a lighter earlier Set', () => {
  const last = withRir(sets('back-squat', [[50, 6], [60, 10], [60, 10]]), [0, 3, 2])
  expect(progression(squat, squatPlan, last).suggestion).toEqual({ kind: 'add-weight', nextWeightKg: 65 })
})

test('O2 a bar that is not full suggests nothing whatever the RIRs', () => {
  const easy = withRir(sets('back-squat', [[60, 10], [60, 10], [60, 9]]), [3, 3, 3])
  expect(progression(squat, squatPlan, easy)).toMatchObject({ isFull: false, suggestion: null })
  const hard = withRir(sets('back-squat', [[60, 10], [60, 10], [60, 9]]), [0, 0, 0])
  expect(progression(squat, squatPlan, hard)).toMatchObject({ isFull: false, suggestion: null })
})

test('O2 a Bodyweight Exercise with a Load moves its Load by 2 / 0 / 1 steps', () => {
  const full = (rirs: Rir[]) => withRir(loaded([[10, 15], [10, 15], [10, 15]]), rirs)
  expect(progression(weightedPushUps, pushUpsPlan, full([2, 2, 3])).suggestion).toEqual({
    kind: 'add-load',
    nextLoadKg: 15,
  })
  expect(progression(weightedPushUps, pushUpsPlan, full([0, 0, 0]))).toMatchObject({
    isFull: true,
    suggestion: { kind: 'hold', nextLoadKg: 10 },
  })
  expect(progression(weightedPushUps, pushUpsPlan, full([undefined, undefined, undefined])).suggestion).toEqual({
    kind: 'add-load',
    nextLoadKg: 12.5,
  })
})

test('O2 an assisted Exercise moves toward less assistance by 2 steps after an easy full bar', () => {
  const last = withRir(
    [-27, -27, -27].map((loadKg, i) => ({
      exerciseId: 'assisted-pull-ups',
      setIndex: i + 1,
      weightKg: null,
      loadKg,
      reps: pullUpsPlan.repRange[1],
      loggedAt: 1000 + i,
    })),
    [2, 2, 2],
  )
  expect(progression(assistedPullUps, pullUpsPlan, last).suggestion).toEqual({
    kind: 'add-load',
    nextLoadKg: -25,
  })
})

test('O2 a plain Bodyweight bar adds one set after an easy bar, never two, and holds at RIR 0', () => {
  const full = (rirs: Rir[]) => withRir(sets('push-ups', [[null, 15], [null, 15], [null, 15]]), rirs)
  expect(progression(pushUps, pushUpsPlan, full([3, 3, 3])).suggestion).toEqual({ kind: 'add-set' })
  expect(progression(pushUps, pushUpsPlan, full([undefined, undefined, undefined])).suggestion).toEqual({
    kind: 'add-set',
  })
  expect(progression(pushUps, pushUpsPlan, full([0, 0, 0]))).toMatchObject({
    isFull: true,
    suggestion: { kind: 'hold' },
  })
})
