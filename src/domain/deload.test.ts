import { expect, test } from 'vitest'
import { deloadText, deloadWeight, isDeloadWeek } from './deload'

test('O5 deloadWeight takes 10 % off in whole weight steps', () => {
  expect(deloadWeight(80, 2.5)).toBe(72.5)
  expect(deloadWeight(13, 1)).toBe(12)
  expect(deloadWeight(13, 2)).toBe(11)
})

test('O5 deloadWeight takes the lighter weight when 10 % is a tie between two step counts', () => {
  expect(deloadWeight(62.5, 2.5)).toBe(55)
})

test('O5 deloadWeight takes off at least one step', () => {
  expect(deloadWeight(5, 2.5)).toBe(2.5)
})

test('O5 deloadWeight never goes below 0', () => {
  expect(deloadWeight(2, 2.5)).toBe(0)
  expect(deloadWeight(0, 2.5)).toBe(0)
})

test('O5 deloadText reads Deload: deloaded (from original)', () => {
  expect(deloadText(72.5, 80)).toBe('Deload: 72.5 (from 80)')
})

const day = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime()

test('O6 a Saturday-start deload week holds until Saturday 00:00', () => {
  const stored = day(2026, 10, 17)
  expect(isDeloadWeek(stored, day(2026, 10, 23, 23, 59), 6)).toBe(true)
  expect(isDeloadWeek(stored, day(2026, 10, 24), 6)).toBe(false)
})

test('O6 a Monday-start deload week holds until Monday 00:00', () => {
  const stored = day(2026, 10, 12)
  expect(isDeloadWeek(stored, day(2026, 10, 18), 1)).toBe(true)
  expect(isDeloadWeek(stored, day(2026, 10, 19), 1)).toBe(false)
})

test('O6 no stored deload week is never a deload week', () => {
  expect(isDeloadWeek(null, day(2026, 10, 18), 1)).toBe(false)
})
