import { describe, expect, it } from 'vitest'
import { DEFAULT_PLATE_INVENTORY } from './plates'
import { liftEstimate, percentTable, repMaxTable } from './calculator'
import type { PlateInventory } from '../types'

// No 1.25 plates: the smallest step is 5 kg on the bar.
const NO_SMALL_PLATES: PlateInventory = {
  barKg: 20,
  plates: [
    { kg: 25, pairs: 10 },
    { kg: 20, pairs: 10 },
    { kg: 15, pairs: 10 },
    { kg: 10, pairs: 10 },
    { kg: 5, pairs: 10 },
    { kg: 2.5, pairs: 10 },
  ],
}

describe('O6 liftEstimate', () => {
  it('estimates 100 kg x 5 as 116.7 kg', () => {
    expect(liftEstimate(100, 5)).toBeCloseTo(116.667, 2)
  })
  it('estimates a single rep as weight x 1.0333', () => {
    expect(liftEstimate(90, 1)).toBeCloseTo(93, 5)
  })
})

describe('O6 repMaxTable', () => {
  it('has 12 rows for reps 1 to 12 in order', () => {
    const rows = repMaxTable(100, DEFAULT_PLATE_INVENTORY)
    expect(rows.map((r) => r.reps)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })
  it('gives the estimate itself for 1 rep', () => {
    const [one] = repMaxTable(100, DEFAULT_PLATE_INVENTORY)
    expect(one.rawKg).toBeCloseTo(100, 5)
    expect(one.loadKg).toBe(100)
  })
  it('uses est / (1 + n/30) for n reps', () => {
    const rows = repMaxTable(100, DEFAULT_PLATE_INVENTORY)
    expect(rows[4].rawKg).toBeCloseTo(85.714, 2)
    expect(rows[9].rawKg).toBeCloseTo(75, 5)
    expect(rows[11].rawKg).toBeCloseTo(71.429, 2)
  })
  it('rounds each row down to the nearest loadable weight with the default plates', () => {
    const rows = repMaxTable(100, DEFAULT_PLATE_INVENTORY)
    expect(rows.map((r) => r.loadKg)).toEqual([100, 92.5, 90, 87.5, 85, 82.5, 80, 77.5, 75, 75, 72.5, 70])
  })
  it('rounds differently when the inventory lacks 1.25 plates', () => {
    const rows = repMaxTable(100, NO_SMALL_PLATES)
    expect(rows[5].loadKg).toBe(80)
    expect(rows[1].loadKg).toBe(90)
  })
  it('carries the plate loading that makes loadKg', () => {
    const row = repMaxTable(100, DEFAULT_PLATE_INVENTORY)[5]
    expect(row.loading).not.toBeNull()
    expect(row.loading?.madeKg).toBe(82.5)
    expect(row.loading?.perSide).toEqual([25, 5, 1.25])
  })
})

describe('O7 percentTable', () => {
  it('has rows for 50 to 95 percent in steps of 5', () => {
    const rows = percentTable(100, DEFAULT_PLATE_INVENTORY)
    expect(rows.map((r) => r.percent)).toEqual([50, 55, 60, 65, 70, 75, 80, 85, 90, 95])
  })
  it('takes each percent of the estimate', () => {
    const rows = percentTable(120, DEFAULT_PLATE_INVENTORY)
    expect(rows[0].rawKg).toBeCloseTo(60, 5)
    expect(rows[9].rawKg).toBeCloseTo(114, 5)
  })
  it('rounds to the nearest loadable weight with the default plates', () => {
    const rows = percentTable(103, DEFAULT_PLATE_INVENTORY)
    expect(rows[9].rawKg).toBeCloseTo(97.85, 5)
    expect(rows[9].loadKg).toBe(97.5)
    expect(rows[0].loadKg).toBe(50)
  })
  it('rounds differently when the inventory lacks 1.25 plates', () => {
    const rows = percentTable(103, NO_SMALL_PLATES)
    expect(rows[9].loadKg).toBe(95)
  })
  it('has no loading and the raw weight when lighter than the bar', () => {
    const rows = percentTable(30, DEFAULT_PLATE_INVENTORY)
    expect(rows[0].rawKg).toBeCloseTo(15, 5)
    expect(rows[0].loading).toBeNull()
    expect(rows[0].loadKg).toBe(15)
  })
})
