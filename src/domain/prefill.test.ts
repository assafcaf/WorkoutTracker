import { expect, test } from 'vitest'
import { loadCatalog, loadPrograms } from '../data/catalog'
import { presetForSet, presetFromSet } from './prefill'
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
    today: [],
  })

  expect(result).toEqual({ weightKg: 60, reps: 8 })
})

test('O5 the third working Set opens on last time’s third working Set when no warm-up was logged today', () => {
  const result = presetForSet({
    exercise: squatExercise,
    plan: squatPlan,
    setIndex: 3,
    lastEntries: warmedUpLastTime,
    today: [squatSet(1, 60, 8), squatSet(2, 62.5, 8)],
  })

  expect(result).toEqual({ weightKg: 65, reps: 6 })
})

test('O5 a Set opened after today’s warm-up keeps the working target: last time’s first working Set', () => {
  const result = presetForSet({
    exercise: squatExercise,
    plan: squatPlan,
    setIndex: 2,
    lastEntries: warmedUpLastTime,
    today: [squatSet(1, 20, 12, 'warmup')],
  })

  expect(result).toEqual({ weightKg: 60, reps: 8 })
})

test('O5 the second working Set after a warm-up and a working Set today opens on last time’s second working Set', () => {
  const result = presetForSet({
    exercise: squatExercise,
    plan: squatPlan,
    setIndex: 3,
    lastEntries: warmedUpLastTime,
    today: [squatSet(1, 20, 12, 'warmup'), squatSet(2, 60, 8)],
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
    today: [],
  })

  expect(result).toEqual({ weightKg: 50, reps: 8 })
})

test('O16 a bodyweight exercise carries the matched Set loadKg into the Preset like a weight', () => {
  const lastEntries: SetEntry[] = [
    { exerciseId: 'push-ups', setIndex: 1, weightKg: null, reps: 12, loggedAt: 1, loadKg: 10 },
    { exerciseId: 'push-ups', setIndex: 2, weightKg: null, reps: 9, loggedAt: 2, loadKg: 12.5 },
  ]

  expect(
    presetForSet({ exercise: pushUpsExercise, plan: pushUpsPlan, setIndex: 1, lastEntries }),
  ).toEqual({ weightKg: null, reps: 12, loadKg: 10 })
  expect(
    presetForSet({ exercise: pushUpsExercise, plan: pushUpsPlan, setIndex: 2, lastEntries }),
  ).toEqual({ weightKg: null, reps: 9, loadKg: 12.5 })
  // past last time's Sets: the last one as it was lifted
  expect(
    presetForSet({ exercise: pushUpsExercise, plan: pushUpsPlan, setIndex: 3, lastEntries }),
  ).toEqual({ weightKg: null, reps: 9, loadKg: 12.5 })
})

test('O16 a bodyweight Preset with no loaded Set answers exactly as before, with no loadKg', () => {
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
  expect(result).not.toHaveProperty('loadKg')
})

// --- E16-T6 O11: the Preset carries today's change from last time's shape --------------------

/** A back-squat Set: working unless `kind` says otherwise. */
function squat(
  setIndex: number,
  weightKg: number,
  reps: number,
  kind?: 'warmup' | 'drop',
): SetEntry {
  return {
    exerciseId: 'back-squat',
    setIndex,
    weightKg,
    reps,
    loggedAt: 100 + setIndex,
    ...(kind === undefined ? {} : { kind }),
  }
}

/** A push-ups Set at signed Load `loadKg` (`0` is plain `BW`, stored with no `loadKg`). */
function pushUp(setIndex: number, loadKg: number, reps: number): SetEntry {
  return {
    exerciseId: 'push-ups',
    setIndex,
    weightKg: null,
    reps,
    loggedAt: 100 + setIndex,
    ...(loadKg === 0 ? {} : { loadKg }),
  }
}

function squatPreset(setIndex: number, lastEntries: SetEntry[], today: SetEntry[]) {
  return presetForSet({
    exercise: squatExercise,
    plan: squatPlan,
    setIndex,
    lastEntries,
    today,
  })
}

function pushUpPreset(setIndex: number, lastEntries: SetEntry[], today: SetEntry[]) {
  return presetForSet({
    exercise: pushUpsExercise,
    plan: pushUpsPlan,
    setIndex,
    lastEntries,
    today,
  })
}

const flat80: SetEntry[] = [squat(1, 80, 8), squat(2, 80, 8), squat(3, 80, 8)]
const pyramid: SetEntry[] = [squat(1, 60, 10), squat(2, 70, 8), squat(3, 80, 6)]

test('O11 last time 80·80·80, today 82.5: Set 2 opens at 82.5 with last time’s reps', () => {
  expect(squatPreset(2, flat80, [squat(1, 82.5, 8)])).toEqual({ weightKg: 82.5, reps: 8 })
})

test('O11 last time 80·80·80, today 82.5·82.5: Set 3 opens at 82.5', () => {
  expect(squatPreset(3, flat80, [squat(1, 82.5, 8), squat(2, 82.5, 8)])).toEqual({
    weightKg: 82.5,
    reps: 8,
  })
})

test('O11 last time 60·70·80, today 62.5: Set 2 opens at 72.5 with Set 2’s reps', () => {
  expect(squatPreset(2, pyramid, [squat(1, 62.5, 10)])).toEqual({ weightKg: 72.5, reps: 8 })
})

test('O11 last time 60·70·80, today 62.5·72.5: Set 3 opens at 82.5 with Set 3’s reps', () => {
  expect(squatPreset(3, pyramid, [squat(1, 62.5, 10), squat(2, 72.5, 8)])).toEqual({
    weightKg: 82.5,
    reps: 6,
  })
})

test('O11 last time 80·80·80, today down to 75: Set 2 opens at 75', () => {
  expect(squatPreset(2, flat80, [squat(1, 75, 8)])).toEqual({ weightKg: 75, reps: 8 })
})

test('O11 the anchor skips a Warm-up logged after today’s working Set', () => {
  // today: 82.5 working, then a 40 warm-up; the anchor is the 82.5 at working position 1
  expect(squatPreset(3, flat80, [squat(1, 82.5, 8), squat(2, 40, 10, 'warmup')])).toEqual({
    weightKg: 82.5,
    reps: 8,
  })
})

test('O11 the anchor skips a drop Set logged after today’s working Set', () => {
  // today: 82.5 working, then a 60 drop; the drop does not pull the next Set down to 60
  expect(squatPreset(3, flat80, [squat(1, 82.5, 8), squat(2, 60, 12, 'drop')])).toEqual({
    weightKg: 82.5,
    reps: 8,
  })
})

test('O11 past last time’s working Sets, the Set opens on the anchor’s value and reps', () => {
  const lastTwo = [squat(1, 80, 8), squat(2, 80, 8)]
  expect(squatPreset(3, lastTwo, [squat(1, 82.5, 8), squat(2, 82.5, 7)])).toEqual({
    weightKg: 82.5,
    reps: 7,
  })
})

test('O11 with no last time at all, the Set opens on today’s anchor, not the start weight', () => {
  expect(squatPreset(2, [], [squat(1, 70, 9)])).toEqual({ weightKg: 70, reps: 9 })
})

test('O11 with no last-time Set at the anchor’s position, the Set opens on the anchor', () => {
  // last time had one working Set; today's anchor is at working position 2, so L[2] is missing
  expect(squatPreset(3, [squat(1, 80, 8)], [squat(1, 82.5, 8), squat(2, 85, 6)])).toEqual({
    weightKg: 85,
    reps: 6,
  })
})

test('O11 the anchor’s working position counts past today’s warm-ups', () => {
  // today: a warm-up, then 62.5 at working position 1; next is working position 2 -> 70 + 2.5
  expect(squatPreset(3, pyramid, [squat(1, 40, 10, 'warmup'), squat(2, 62.5, 10)])).toEqual({
    weightKg: 72.5,
    reps: 8,
  })
})

test('O11 a shifted loaded Preset is kept at or below 500 kg', () => {
  const heavy = [squat(1, 480, 3), squat(2, 495, 2)]
  expect(squatPreset(2, heavy, [squat(1, 490, 3)])).toEqual({ weightKg: 500, reps: 2 })
})

test('O11 a shifted loaded Preset is kept at or above 0 kg', () => {
  const dropping = [squat(1, 50, 10), squat(2, 20, 12)]
  expect(squatPreset(2, dropping, [squat(1, 20, 10)])).toEqual({ weightKg: 0, reps: 12 })
})

test('O11 on a Bodyweight Exercise the signed Load carries today’s change: BW+10 → BW+15', () => {
  const last = [pushUp(1, 10, 12), pushUp(2, 10, 10)]
  expect(pushUpPreset(2, last, [pushUp(1, 15, 12)])).toEqual({
    weightKg: null,
    reps: 10,
    loadKg: 15,
  })
})

test('O11 on a Bodyweight Exercise BW counts as 0: last time BW·BW, today BW+5 → BW+5', () => {
  const last = [pushUp(1, 0, 12), pushUp(2, 0, 11)]
  expect(pushUpPreset(2, last, [pushUp(1, 5, 12)])).toEqual({
    weightKg: null,
    reps: 11,
    loadKg: 5,
  })
})

test('O11 an assisted Load shifts too: last time BW−30·BW−27, today BW−25 → BW−22', () => {
  const last = [pushUp(1, -30, 8), pushUp(2, -27, 8)]
  expect(pushUpPreset(2, last, [pushUp(1, -25, 8)])).toEqual({
    weightKg: null,
    reps: 8,
    loadKg: -22,
  })
})

test('O11 a shifted Load is kept at or below +100 kg', () => {
  const last = [pushUp(1, 90, 5), pushUp(2, 98, 4)]
  expect(pushUpPreset(2, last, [pushUp(1, 95, 5)])).toEqual({
    weightKg: null,
    reps: 4,
    loadKg: 100,
  })
})

test('O11 a shifted Load is kept at or above −60 kg', () => {
  const last = [pushUp(1, -50, 8), pushUp(2, -58, 8)]
  expect(pushUpPreset(2, last, [pushUp(1, -55, 8)])).toEqual({
    weightKg: null,
    reps: 8,
    loadKg: -60,
  })
})

test('O11 a Bodyweight Exercise with no history opens on its startLoadKg', () => {
  const assisted: Exercise = { ...pushUpsExercise, startLoadKg: -27 }
  expect(
    presetForSet({ exercise: assisted, plan: pushUpsPlan, setIndex: 1, lastEntries: [] }),
  ).toEqual({ weightKg: null, reps: pushUpsPlan.repRange[0], loadKg: -27 })
})

// --- E16-T6 O12: a Set of the other mode translates into the current one -------------------

test('O12 a logged 20 kg on a now-Bodyweight Exercise opens as BW+20', () => {
  const lastEntries: SetEntry[] = [
    { exerciseId: 'push-ups', setIndex: 1, weightKg: 20, reps: 8, loggedAt: 1 },
  ]
  const stored = structuredClone(lastEntries)

  expect(
    presetForSet({ exercise: pushUpsExercise, plan: pushUpsPlan, setIndex: 1, lastEntries }),
  ).toEqual({ weightKg: null, reps: 8, loadKg: 20 })
  expect(lastEntries).toEqual(stored)
})

test('O12 a logged Load on a now-loaded Exercise opens on the start weight', () => {
  const lastEntries: SetEntry[] = [
    { exerciseId: 'back-squat', setIndex: 1, weightKg: null, reps: 8, loggedAt: 1, loadKg: 10 },
  ]
  const stored = structuredClone(lastEntries)

  const result = presetForSet({
    exercise: squatExercise,
    plan: squatPlan,
    setIndex: 1,
    lastEntries,
  })

  expect(result.weightKg).toBe(50)
  expect(result).not.toHaveProperty('loadKg')
  expect(lastEntries).toEqual(stored)
})

test('O12 today’s change carries across modes: last time 20 kg·20 kg, today BW+25 → BW+25', () => {
  const last: SetEntry[] = [
    { exerciseId: 'push-ups', setIndex: 1, weightKg: 20, reps: 8, loggedAt: 1 },
    { exerciseId: 'push-ups', setIndex: 2, weightKg: 20, reps: 8, loggedAt: 2 },
  ]
  expect(pushUpPreset(2, last, [pushUp(1, 25, 8)])).toEqual({
    weightKg: null,
    reps: 8,
    loadKg: 25,
  })
})

test('O12 presetFromSet turns 20 kg into BW+20 on a Bodyweight Exercise, keeping the reps', () => {
  const set = Object.freeze({ weightKg: 20, reps: 8 })
  expect(presetFromSet({ exercise: pushUpsExercise, plan: pushUpsPlan, set })).toEqual({
    weightKg: null,
    reps: 8,
    loadKg: 20,
  })
  expect(set).toEqual({ weightKg: 20, reps: 8 })
})

test('O12 presetFromSet turns 0 kg into plain BW, with no loadKg', () => {
  const result = presetFromSet({
    exercise: pushUpsExercise,
    plan: pushUpsPlan,
    set: Object.freeze({ weightKg: 0, reps: 12 }),
  })
  expect(result).toEqual({ weightKg: null, reps: 12 })
  expect(result).not.toHaveProperty('loadKg')
})

test('O12 presetFromSet turns a Load on a loaded Exercise into the start weight', () => {
  const result = presetFromSet({
    exercise: squatExercise,
    plan: squatPlan,
    set: Object.freeze({ weightKg: null, reps: 8, loadKg: 15 }),
  })
  expect(result.weightKg).toBe(50)
  expect(result).not.toHaveProperty('loadKg')
})

test('O12 presetFromSet turns plain BW on a loaded Exercise into the Plan start weight', () => {
  const result = presetFromSet({
    exercise: squatExercise,
    plan: { ...squatPlan, startWeightKg: 40 },
    set: Object.freeze({ weightKg: null, reps: 8 }),
  })
  expect(result.weightKg).toBe(40)
})

test('O12 presetFromSet keeps a Set already in the current mode as it is', () => {
  expect(
    presetFromSet({
      exercise: squatExercise,
      plan: squatPlan,
      set: Object.freeze({ weightKg: 62.5, reps: 9 }),
    }),
  ).toEqual({ weightKg: 62.5, reps: 9 })
  expect(
    presetFromSet({
      exercise: pushUpsExercise,
      plan: pushUpsPlan,
      set: Object.freeze({ weightKg: null, reps: 9, loadKg: -27 }),
    }),
  ).toEqual({ weightKg: null, reps: 9, loadKg: -27 })
})
