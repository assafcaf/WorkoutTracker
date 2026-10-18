import { expect, test } from 'vitest'
import { effortSteps } from './effortStep'
import type { SetEntry } from '../types'

function bar(rirs: Array<0 | 1 | 2 | 3 | undefined>): SetEntry[] {
  return rirs.map((rir, i) => ({
    exerciseId: 'back-squat',
    setIndex: i + 1,
    weightKg: 60,
    reps: 10,
    loggedAt: 1000 + i,
    ...(rir === undefined ? {} : { rir }),
  }))
}

test('O1 every Set at RIR 2 or more is two steps', () => {
  expect(effortSteps(bar([2, 3, 2]))).toBe(2)
  expect(effortSteps(bar([3, 3, 3]))).toBe(2)
  expect(effortSteps(bar([2, 2, 2]))).toBe(2)
})

test('O1 every Set at RIR 0 is no step', () => {
  expect(effortSteps(bar([0, 0, 0]))).toBe(0)
  expect(effortSteps(bar([0]))).toBe(0)
})

test('O1 a mix of RIRs is one step', () => {
  expect(effortSteps(bar([2, 1, 2]))).toBe(1)
  expect(effortSteps(bar([0, 0, 1]))).toBe(1)
  expect(effortSteps(bar([0, 2, 3]))).toBe(1)
  expect(effortSteps(bar([1, 1, 1]))).toBe(1)
})

test('O1 any Set without RIR is one step, even when the others are easy or hard', () => {
  expect(effortSteps(bar([undefined, undefined, undefined]))).toBe(1)
  expect(effortSteps(bar([3, 3, undefined]))).toBe(1)
  expect(effortSteps(bar([0, 0, undefined]))).toBe(1)
})
