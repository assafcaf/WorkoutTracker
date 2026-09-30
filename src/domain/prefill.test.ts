import { expect, test } from 'vitest'
import { loadCatalog, loadPrograms } from '../data/catalog'
import { presetForSet } from './prefill'
import type { Exercise, ExercisePlan, SetEntry } from '../types'

// The real catalog and the real assaf-ab-2026 program, per the task note: O6 names exactly
// this case (back-squat, Workout A, 4 sets, repRange [8, 10]), so the fixtures below are the
// bundled data rather than hand-rolled doubles.
const catalog = loadCatalog()
const programs = loadPrograms(catalog)

function planFor(programId: string, workoutId: string, exerciseId: string): ExercisePlan {
  const program = programs.find((p) => p.id === programId)
  if (!program) throw new Error(`fixture error: no program ${programId}`)
  const workout = program.workouts.find((w) => w.id === workoutId)
  if (!workout) throw new Error(`fixture error: no workout ${workoutId} in ${programId}`)
  const plan = workout.exercises.find((e) => e.exerciseId === exerciseId)
  if (!plan) throw new Error(`fixture error: no plan for ${exerciseId} in ${workoutId}`)
  return plan
}

function exerciseFor(exerciseId: string): Exercise {
  const exercise = catalog.get(exerciseId)
  if (!exercise) throw new Error(`fixture error: no exercise ${exerciseId} in the catalog`)
  return exercise
}

const squatExercise = exerciseFor('back-squat')
const squatPlan = planFor('assaf-ab-2026', 'workout-a', 'back-squat')

const pushUpsExercise = exerciseFor('push-ups')
const pushUpsPlan = planFor('assaf-ab-2026', 'workout-a', 'push-ups')

test('O4 set 2 opens on the last session values, even though a higher setIndex exists', () => {
  const lastEntries: SetEntry[] = [
    { exerciseId: 'back-squat', setIndex: 1, weightKg: 55, reps: 8, loggedAt: 1 },
    { exerciseId: 'back-squat', setIndex: 2, weightKg: 60, reps: 10, loggedAt: 2 },
    { exerciseId: 'back-squat', setIndex: 3, weightKg: 62.5, reps: 9, loggedAt: 3 },
  ]

  const result = presetForSet({
    exercise: squatExercise,
    plan: squatPlan,
    setIndex: 2,
    lastEntries,
  })

  expect(result).toEqual({ weightKg: 60, reps: 10 })
})

test('O4 set 1 opens on its own logged entry when set 1 exists among others', () => {
  const lastEntries: SetEntry[] = [
    { exerciseId: 'back-squat', setIndex: 1, weightKg: 52.5, reps: 8, loggedAt: 1 },
    { exerciseId: 'back-squat', setIndex: 2, weightKg: 55, reps: 8, loggedAt: 2 },
  ]

  const result = presetForSet({
    exercise: squatExercise,
    plan: squatPlan,
    setIndex: 1,
    lastEntries,
  })

  expect(result).toEqual({ weightKg: 52.5, reps: 8 })
})

test('O6 set 1 opens on the catalog start weight and rep floor when no prior session exists', () => {
  const result = presetForSet({
    exercise: squatExercise,
    plan: squatPlan,
    setIndex: 1,
    lastEntries: [],
  })

  expect(result).toEqual({ weightKg: 50, reps: 8 })
})

test('O7 set 3 opens on the last set actually logged when only 2 of 4 sets were logged', () => {
  const lastEntries: SetEntry[] = [
    { exerciseId: 'back-squat', setIndex: 1, weightKg: 55, reps: 8, loggedAt: 1 },
    { exerciseId: 'back-squat', setIndex: 2, weightKg: 57.5, reps: 9, loggedAt: 2 },
  ]

  const result = presetForSet({
    exercise: squatExercise,
    plan: squatPlan,
    setIndex: 3,
    lastEntries,
  })

  expect(result).toEqual({ weightKg: 57.5, reps: 9 })
})

test('O7 the highest setIndex wins by value, not by position in a sparse unsorted array', () => {
  const lastEntries: SetEntry[] = [
    { exerciseId: 'back-squat', setIndex: 2, weightKg: 56, reps: 8, loggedAt: 2 },
    { exerciseId: 'back-squat', setIndex: 4, weightKg: 61, reps: 9, loggedAt: 4 },
  ]

  const result = presetForSet({
    exercise: squatExercise,
    plan: squatPlan,
    setIndex: 5,
    lastEntries,
  })

  expect(result).toEqual({ weightKg: 61, reps: 9 })
})

test('O4 a bodyweight exercise yields a null weight dial when an entry exists', () => {
  const lastEntries: SetEntry[] = [
    { exerciseId: 'push-ups', setIndex: 1, weightKg: null, reps: 12, loggedAt: 1 },
  ]

  const result = presetForSet({
    exercise: pushUpsExercise,
    plan: pushUpsPlan,
    setIndex: 1,
    lastEntries,
  })

  expect(result).toEqual({ weightKg: null, reps: 12 })
})

test('O6 a bodyweight exercise yields a null weight dial when no prior session exists', () => {
  const result = presetForSet({
    exercise: pushUpsExercise,
    plan: pushUpsPlan,
    setIndex: 1,
    lastEntries: [],
  })

  expect(result).toEqual({ weightKg: null, reps: 10 })
})

test('O4 a Plan startWeightKg presets set 1 when the Exercise itself starts at 0 and there is no history', () => {
  const zeroStartExercise: Exercise = { ...squatExercise, startWeight: 0 }
  const planWithStartWeight: ExercisePlan = { ...squatPlan, startWeightKg: 40 }

  const result = presetForSet({
    exercise: zeroStartExercise,
    plan: planWithStartWeight,
    setIndex: 1,
    lastEntries: [],
  })

  expect(result).toEqual({ weightKg: 40, reps: squatPlan.repRange[0] })
})

test('O4 history still wins over a Plan startWeightKg', () => {
  const zeroStartExercise: Exercise = { ...squatExercise, startWeight: 0 }
  const planWithStartWeight: ExercisePlan = { ...squatPlan, startWeightKg: 40 }
  const lastEntries: SetEntry[] = [
    { exerciseId: 'back-squat', setIndex: 1, weightKg: 55, reps: 8, loggedAt: 1 },
  ]

  const result = presetForSet({
    exercise: zeroStartExercise,
    plan: planWithStartWeight,
    setIndex: 1,
    lastEntries,
  })

  expect(result).toEqual({ weightKg: 55, reps: 8 })
})

test('O4 without a Plan startWeightKg, the Exercise startWeight is used as today', () => {
  const result = presetForSet({
    exercise: squatExercise,
    plan: squatPlan,
    setIndex: 1,
    lastEntries: [],
  })

  expect(result).toEqual({ weightKg: squatExercise.startWeight, reps: squatPlan.repRange[0] })
})

test('O4 a Bodyweight Exercise still presets a null weight dial even with a Plan startWeightKg', () => {
  const planWithStartWeight: ExercisePlan = { ...pushUpsPlan, startWeightKg: 40 }

  const result = presetForSet({
    exercise: pushUpsExercise,
    plan: planWithStartWeight,
    setIndex: 1,
    lastEntries: [],
  })

  expect(result).toEqual({ weightKg: null, reps: pushUpsPlan.repRange[0] })
})

// --- E14-T8 O5: the Preset matches working Sets by position; warm-ups are skipped ------------

function squatSet(
  setIndex: number,
  weightKg: number,
  reps: number,
  kind?: 'warmup',
): SetEntry {
  return {
    exerciseId: 'back-squat',
    setIndex,
    weightKg,
    reps,
    loggedAt: setIndex,
    ...(kind === undefined ? {} : { kind }),
  }
}

/** Last time: two warm-ups, then three working Sets (60×8, 62.5×8, 65×6). */
const warmedUpLastTime: SetEntry[] = [
  squatSet(1, 40, 10, 'warmup'),
  squatSet(2, 50, 8, 'warmup'),
  squatSet(3, 60, 8),
  squatSet(4, 62.5, 8),
  squatSet(5, 65, 6),
]

test('O5 the first working Set opens on last time’s first working Set, past its two warm-ups', () => {
  const result = presetForSet({
    exercise: squatExercise,
    plan: squatPlan,
    setIndex: 1,
    lastEntries: warmedUpLastTime,
    logged: [],
  })

  expect(result).toEqual({ weightKg: 60, reps: 8 })
})

test('O5 the third working Set opens on last time’s third working Set when no warm-up was logged today', () => {
  const result = presetForSet({
    exercise: squatExercise,
    plan: squatPlan,
    setIndex: 3,
    lastEntries: warmedUpLastTime,
    logged: [squatSet(1, 60, 8), squatSet(2, 62.5, 8)],
  })

  expect(result).toEqual({ weightKg: 65, reps: 6 })
})

test('O5 a Set opened after today’s warm-up keeps the working target: last time’s first working Set', () => {
  const result = presetForSet({
    exercise: squatExercise,
    plan: squatPlan,
    setIndex: 2,
    lastEntries: warmedUpLastTime,
    logged: [squatSet(1, 20, 12, 'warmup')],
  })

  expect(result).toEqual({ weightKg: 60, reps: 8 })
})

test('O5 the second working Set after a warm-up and a working Set today opens on last time’s second working Set', () => {
  const result = presetForSet({
    exercise: squatExercise,
    plan: squatPlan,
    setIndex: 3,
    lastEntries: warmedUpLastTime,
    logged: [squatSet(1, 20, 12, 'warmup'), squatSet(2, 60, 8)],
  })

  expect(result).toEqual({ weightKg: 62.5, reps: 8 })
})

test('O5 past last time’s working Sets the Preset is its last working Set, never a warm-up logged after it', () => {
  const lastEntries: SetEntry[] = [
    squatSet(1, 55, 8),
    squatSet(2, 57.5, 9),
    squatSet(3, 40, 12, 'warmup'),
  ]

  const result = presetForSet({
    exercise: squatExercise,
    plan: squatPlan,
    setIndex: 3,
    lastEntries,
  })

  expect(result).toEqual({ weightKg: 57.5, reps: 9 })
})

test('O5 a last time of warm-ups only presets the Exercise start weight and the rep floor', () => {
  const result = presetForSet({
    exercise: squatExercise,
    plan: squatPlan,
    setIndex: 1,
    lastEntries: [squatSet(1, 30, 10, 'warmup'), squatSet(2, 40, 8, 'warmup')],
    logged: [],
  })

  expect(result).toEqual({ weightKg: 50, reps: 8 })
})
