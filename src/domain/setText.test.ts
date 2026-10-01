import { expect, test } from 'vitest'
import { formatSet, formatSetCompact } from './setText'

test('O15 formatSet answers "80 × 8" for a loaded Set', () => {
  expect(formatSet({ weightKg: 80, reps: 8 })).toBe('80 × 8')
})

test('O15 formatSet keeps a fractional load as is: "62.5 × 10"', () => {
  expect(formatSet({ weightKg: 62.5, reps: 10 })).toBe('62.5 × 10')
})

test('O15 formatSet answers "BW × 8" for a Bodyweight Set with no loadKg', () => {
  expect(formatSet({ weightKg: null, reps: 8 })).toBe('BW × 8')
})

test('O15 formatSet answers "BW+10 × 8" for a Bodyweight Set with loadKg 10', () => {
  expect(formatSet({ weightKg: null, reps: 8, loadKg: 10 })).toBe('BW+10 × 8')
})

test('O15 formatSet answers "BW−20 × 8" with a true minus sign for loadKg -20', () => {
  const text = formatSet({ weightKg: null, reps: 8, loadKg: -20 })
  expect(text).toBe('BW−20 × 8')
  expect(text).not.toContain('-')
})

test('O15 formatSet keeps a fractional signed load: "BW+2.5 × 12"', () => {
  expect(formatSet({ weightKg: null, reps: 12, loadKg: 2.5 })).toBe('BW+2.5 × 12')
})

test('O15 formatSetCompact answers the same without the spaces for each kind of Set', () => {
  expect(formatSetCompact({ weightKg: 80, reps: 8 })).toBe('80×8')
  expect(formatSetCompact({ weightKg: null, reps: 8 })).toBe('BW×8')
  expect(formatSetCompact({ weightKg: null, reps: 8, loadKg: 10 })).toBe('BW+10×8')
  expect(formatSetCompact({ weightKg: null, reps: 8, loadKg: -20 })).toBe('BW−20×8')
})
