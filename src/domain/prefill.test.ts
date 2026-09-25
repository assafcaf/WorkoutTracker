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
