import { expect, test } from 'vitest'
import type { PlateInventory } from '../types'
import { DEFAULT_PLATE_INVENTORY } from './plates'
import { WARMUP_MIN_WORKING_KG, warmupRamp } from './warmup'

const inv = DEFAULT_PLATE_INVENTORY

test('O9 warmupRamp answers 50 × 5, 70 × 3, 85 × 2 for 100 kg with the default Plate inventory', () => {
  expect(warmupRamp(100, inv)).toEqual([
    { weightKg: 50, reps: 5 },
    { weightKg: 70, reps: 3 },
    { weightKg: 85, reps: 2 },
  ])
})

test('O9 warmupRamp answers 20 × 5, 27.5 × 3, 32.5 × 2 for 40 kg, each the nearest loading at or under its percentage', () => {
  // 50% is the 20 kg bar; 70% is 28 kg, made as 27.5; 85% is 34 kg, made as 32.5.
  expect(warmupRamp(40, inv)).toEqual([
    { weightKg: 20, reps: 5 },
    { weightKg: 27.5, reps: 3 },
    { weightKg: 32.5, reps: 2 },
  ])
})

test('O9 warmupRamp answers no steps just under 40 kg', () => {
  expect(warmupRamp(39.5, inv)).toEqual([])
})

test('O9 warmupRamp answers no steps for 0 kg', () => {
  expect(warmupRamp(0, inv)).toEqual([])
})

test('O9 the Warm-up ramp starts at a working weight of 40 kg', () => {
  expect(WARMUP_MIN_WORKING_KG).toBe(40)
  expect(warmupRamp(WARMUP_MIN_WORKING_KG, inv)).toHaveLength(3)
})

test('O9 warmupRamp drops a step that comes out at the same weight as the step before it', () => {
  // Only 20 kg plates: 50 kg can only be made as the 20 kg bar, 70 kg as 60, and 85 kg as 60
  // again, so the 85% step is dropped.
  const twenties: PlateInventory = { barKg: 20, plates: [{ kg: 20, pairs: 5 }] }

  expect(warmupRamp(100, twenties)).toEqual([
    { weightKg: 20, reps: 5 },
    { weightKg: 60, reps: 3 },
  ])
})

test('O9 warmupRamp takes each weight from the given Plate inventory, not the default one', () => {
  // A 10 kg bar and 5 kg plates only: 30 -> 30, 42 -> 40, 51 -> 50.
  const fives: PlateInventory = { barKg: 10, plates: [{ kg: 5, pairs: 10 }] }

  expect(warmupRamp(60, fives)).toEqual([
    { weightKg: 30, reps: 5 },
    { weightKg: 40, reps: 3 },
    { weightKg: 50, reps: 2 },
  ])
})

test('O9 warmupRamp never answers a step under the bar', () => {
  // A 45 kg bar under a 60 kg working weight: 50% and 70% are 30 and 42 kg, both under the bar;
  // 85% is 51 kg, made as 50.
  const heavyBar: PlateInventory = { ...inv, barKg: 45 }

  const steps = warmupRamp(60, heavyBar)

  expect(steps.length).toBeGreaterThan(0)
  expect(steps.filter((step) => !(step.weightKg >= 45))).toEqual([])
  expect(steps[steps.length - 1]).toEqual({ weightKg: 50, reps: 2 })
})
