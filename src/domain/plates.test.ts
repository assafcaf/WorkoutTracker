import { expect, test } from 'vitest'
import type { LibraryExercise, PlateInventory } from '../types'
import { DEFAULT_PLATE_INVENTORY, formatPlates, isBarbell, platesFor } from './plates'

const inv = DEFAULT_PLATE_INVENTORY

test('O1 platesFor answers the plates for 82.5 kg with the default Plate inventory', () => {
  expect(platesFor(82.5, inv)).toEqual({ perSide: [25, 5, 1.25], madeKg: 82.5, exact: true })
})

test('O1 platesFor answers bar only for the bar weight', () => {
  expect(platesFor(20, inv)).toEqual({ perSide: [], madeKg: 20, exact: true })
})

test('O1 platesFor answers the nearest lighter loading, not exact, for 83 kg', () => {
  expect(platesFor(83, inv)).toEqual({ perSide: [25, 5, 1.25], madeKg: 82.5, exact: false })
})

test('O1 platesFor answers null for a weight under the bar', () => {
  expect(platesFor(19.5, inv)).toBeNull()
})

test('O1 platesFor answers the bar for a weight just above it that no plate can make', () => {
  expect(platesFor(21, inv)).toEqual({ perSide: [], madeKg: 20, exact: false })
})

test('O2 platesFor finds the exact loading where taking the largest plate first would stop short', () => {
  const limited: PlateInventory = {
    barKg: 20,
    plates: [
      { kg: 20, pairs: 1 },
      { kg: 15, pairs: 2 },
    ],
  }
  expect(platesFor(80, limited)).toEqual({ perSide: [15, 15], madeKg: 80, exact: true })
})

test('O2 platesFor never uses more pairs of a plate than the inventory holds', () => {
  const limited: PlateInventory = {
    barKg: 20,
    plates: [
      { kg: 25, pairs: 1 },
      { kg: 10, pairs: 1 },
    ],
  }
  // 100 kg needs 40 kg a side; only 25 + 10 = 35 is possible
  expect(platesFor(100, limited)).toEqual({ perSide: [25, 10], madeKg: 90, exact: false })
})

test('O2 platesFor prefers the heavier plates first among loadings that make the same weight', () => {
  const inventory: PlateInventory = {
    barKg: 20,
    plates: [
      { kg: 20, pairs: 1 },
      { kg: 10, pairs: 3 },
    ],
  }
  // 30 a side: [20, 10] beats [10, 10, 10]
  expect(platesFor(80, inventory)).toEqual({ perSide: [20, 10], madeKg: 80, exact: true })
})

test('O2 platesFor prefers one heavy plate over two lighter ones making the same weight', () => {
  const inventory: PlateInventory = {
    barKg: 20,
    plates: [
      { kg: 10, pairs: 2 },
      { kg: 20, pairs: 1 },
    ],
  }
  expect(platesFor(60, inventory)).toEqual({ perSide: [20], madeKg: 60, exact: true })
})

test('O2 platesFor never uses a plate with 0 pairs', () => {
  const inventory: PlateInventory = {
    barKg: 20,
    plates: [
      { kg: 25, pairs: 0 },
      { kg: 10, pairs: 5 },
      { kg: 5, pairs: 5 },
    ],
  }
  expect(platesFor(70, inventory)).toEqual({ perSide: [10, 10, 5], madeKg: 70, exact: true })
})

test('O2 platesFor with no plates answers only the bar', () => {
  expect(platesFor(100, { barKg: 20, plates: [] })).toEqual({ perSide: [], madeKg: 20, exact: false })
})

test('O2 platesFor answers an inventory at the limits (12 sizes x 20 pairs) without a noticeable delay', () => {
  const big: PlateInventory = {
    barKg: 20,
    plates: Array.from({ length: 12 }, (_, i) => ({ kg: (12 - i) * 0.5 + 0.25, pairs: 20 })),
  }
  const started = Date.now()
  const result = platesFor(777.7, big)
  const elapsed = Date.now() - started
  expect(result).not.toBeNull()
  expect(result!.madeKg).toBeLessThanOrEqual(777.7)
  expect(result!.madeKg).toBeGreaterThan(770)
  expect(elapsed).toBeLessThan(1000)
})

test('O3 formatPlates words an exact loading', () => {
  expect(formatPlates({ perSide: [25, 5, 1.25], madeKg: 82.5, exact: true }, inv)).toBe(
    'Per side: 25 · 5 · 1.25',
  )
})

test('O3 formatPlates words an exact loading with no plates as Bar only', () => {
  expect(formatPlates({ perSide: [], madeKg: 20, exact: true }, inv)).toBe('Bar only')
})

test('O3 formatPlates words a loading that is not exact with the nearest weight', () => {
  expect(formatPlates({ perSide: [25, 5, 1.25], madeKg: 82.5, exact: false }, inv)).toBe(
    'Nearest 82.5 kg · per side: 25 · 5 · 1.25',
  )
})

test('O3 formatPlates words a not-exact loading with no plates as nearest bar only', () => {
  expect(formatPlates({ perSide: [], madeKg: 20, exact: false }, inv)).toBe('Nearest 20 kg · bar only')
})

test('O3 formatPlates words null as lighter than the inventory bar', () => {
  expect(formatPlates(null, inv)).toBe('Lighter than the 20 kg bar')
  expect(formatPlates(null, { barKg: 15, plates: [] })).toBe('Lighter than the 15 kg bar')
})

const entry = (equipment: string | null): LibraryExercise => ({
  id: 'x',
  name: 'X',
  force: null,
  level: 'beginner',
  mechanic: null,
  equipment,
  primaryMuscles: [],
  secondaryMuscles: [],
  instructions: [],
  category: 'strength',
  images: [],
})

test('isBarbell is true only for barbell equipment', () => {
  expect(isBarbell(entry('barbell'))).toBe(true)
  expect(isBarbell(entry('e-z curl bar'))).toBe(false)
  expect(isBarbell(entry('dumbbell'))).toBe(false)
  expect(isBarbell(entry(null))).toBe(false)
  expect(isBarbell(undefined)).toBe(false)
})
