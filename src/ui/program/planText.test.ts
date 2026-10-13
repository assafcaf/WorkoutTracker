import { expect, test } from 'vitest'
import { plural, repRangeText, setsRepsText, wholeCounts } from './planText'

test('setsRepsText reads sets × a rep range, or a single rep count when both ends match', () => {
  expect(setsRepsText({ sets: 4, repRange: [8, 10] })).toBe('4 × 8–10')
  expect(setsRepsText({ sets: 5, repRange: [5, 5] })).toBe('5 × 5')
  expect(repRangeText([10, 15])).toBe('10–15')
})

test('wholeCounts rounds so the parts still add up to the rounded whole, the larger remainder first', () => {
  expect(wholeCounts([28.5, 21, 10.5, 9])).toEqual([29, 21, 10, 9])
  expect(wholeCounts([1.4, 1.4, 1.2])).toEqual([2, 1, 1])
  expect(wholeCounts([3, 4])).toEqual([3, 4])
})

test('plural picks the one or the many form', () => {
  expect(plural(1, 'workout', 'workouts')).toBe('1 workout')
  expect(plural(2, 'workout', 'workouts')).toBe('2 workouts')
})
