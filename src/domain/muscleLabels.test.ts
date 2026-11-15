import { expect, test } from 'vitest'
import { muscleLabel } from './muscleLabels'

test('V2-13 muscles read in the Progress vocabulary: Quads, Mid back, Abs', () => {
  expect(muscleLabel('quadriceps')).toBe('Quads')
  expect(muscleLabel('middle back')).toBe('Mid back')
  expect(muscleLabel('abdominals')).toBe('Abs')
})

test('V2-13 every other muscle is its stored name, capitalised', () => {
  expect(muscleLabel('lats')).toBe('Lats')
  expect(muscleLabel('lower back')).toBe('Lower back')
})
