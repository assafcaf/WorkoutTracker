import { expect, test } from 'vitest'
import { loadCatalog } from '../data/catalog'
import { swapPreset } from './swapPreset'
import type { Exercise, ExercisePlan, SetEntry } from '../types'

// E16-T12 O23: where a swapped-in Exercise's Set opens. The planned Exercise is the catalog's
// seated-biceps-curls under Workout B's Plan; the chosen ones are built by hand so each Ladder
// (the Rungs of its weightStep, from that step upward) is known.
const catalog = loadCatalog()
const planned = catalog.get('seated-biceps-curls') as Exercise
const pushUps = catalog.get('push-ups') as Exercise
const plan: ExercisePlan = {
  exerciseId: 'seated-biceps-curls',
  sets: 3,
  repRange: [10, 12],
  restSeconds: 90,
}

/** A loaded Exercise whose Rungs are 5, 10, 15, ... */
const machineCurl: Exercise = {
  id: 'Machine_Curl',
  name: 'Machine Curl',
  weightStep: 5,
  startWeight: 0,
  bodyweight: false,
  libraryId: 'Machine_Curl',
}

/** A loaded Exercise whose Rungs are 2.5, 5, 7.5, ... */
const cableCurl: Exercise = { ...machineCurl, id: 'Cable_Curl', name: 'Cable Curl', weightStep: 2.5 }

function entry(
  exerciseId: string,
  setIndex: number,
  weightKg: number | null,
  reps: number,
  loadKg?: number,
): SetEntry {
  return {
    exerciseId,
    setIndex,
    weightKg,
    reps,
    loggedAt: 1_700_000_000_000 + setIndex,
    ...(loadKg === undefined ? {} : { loadKg }),
  }
}

test('O23 a never-logged chosen Exercise opens on the planned weight and reps, snapped down to its Rung', () => {
  // The planned Exercise would open on 12 kg x 10 (its last time); 12 sits between 10 and 15.
  const result = swapPreset({
    planned,
    chosen: machineCurl,
    plan,
    setIndex: 1,
    plannedLast: [entry('seated-biceps-curls', 1, 12, 10)],
    chosenLast: [],
    today: [],
  })

  expect(result).toEqual({ weightKg: 10, reps: 10 })
})

test('O23 a planned weight already on the chosen Exercise’s Rungs is kept', () => {
  const result = swapPreset({
    planned,
    chosen: cableCurl,
    plan,
    setIndex: 1,
    plannedLast: [entry('seated-biceps-curls', 1, 20, 11)],
    chosenLast: [],
    today: [],
  })

  expect(result).toEqual({ weightKg: 20, reps: 11 })
})

test('O23 a never-logged chosen Exercise follows what the planned one did today at the open Set', () => {
  // Set 1 of the planned Exercise went 25 x 8 today; Set 2 opens on that, and 25 is a Rung of 5.
  const result = swapPreset({
    planned,
    chosen: machineCurl,
    plan,
    setIndex: 2,
    plannedLast: [],
    chosenLast: [],
    today: [entry('seated-biceps-curls', 1, 25, 8)],
  })

  expect(result).toEqual({ weightKg: 25, reps: 8 })
})

test('O23 a never-logged chosen Exercise with no history anywhere opens on the planned start weight and low rep', () => {
  // seated-biceps-curls starts at 8 kg; the Plan's low rep is 10; 8 snaps down to 5 on a step of 5.
  const result = swapPreset({
    planned,
    chosen: machineCurl,
    plan,
    setIndex: 1,
    plannedLast: [],
    chosenLast: [],
    today: [],
  })

  expect(result).toEqual({ weightKg: 5, reps: 10 })
})

test('O23 a Bodyweight chosen Exercise never logged before opens on BW with the planned reps', () => {
  const result = swapPreset({
    planned,
    chosen: pushUps,
    plan,
    setIndex: 1,
    plannedLast: [entry('seated-biceps-curls', 1, 12, 9)],
    chosenLast: [],
    today: [],
  })

  expect(result.weightKg).toBeNull()
  expect(result.reps).toBe(9)
  expect(result.loadKg ?? 0).toBe(0)
})

test('O23 a chosen Exercise logged before opens on its own last time, not the planned one’s', () => {
  const result = swapPreset({
    planned,
    chosen: machineCurl,
    plan,
    setIndex: 1,
    plannedLast: [entry('seated-biceps-curls', 1, 12, 10)],
    chosenLast: [entry('Machine_Curl', 1, 35, 6)],
    today: [],
  })

  expect(result).toEqual({ weightKg: 35, reps: 6 })
})

test('O23 a Bodyweight chosen Exercise logged before opens on its own last Load', () => {
  const result = swapPreset({
    planned,
    chosen: pushUps,
    plan,
    setIndex: 1,
    plannedLast: [entry('seated-biceps-curls', 1, 12, 10)],
    chosenLast: [entry('push-ups', 1, null, 15, 10)],
    today: [],
  })

  expect(result).toEqual({ weightKg: null, reps: 15, loadKg: 10 })
})
